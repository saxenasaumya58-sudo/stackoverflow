import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { ReputationLog, ReputationTransaction, User } from "@/lib/models";
import {
  getTransferValidationError,
  REPUTATION_TRANSFER_POLICY,
} from "@/lib/reputation-policy.mjs";

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function isUnsupportedTransaction(error) {
  return (
    error.code === 20 ||
    error.codeName === "IllegalOperation" ||
    /transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(error.message || "")
  );
}

async function runTransferTransaction(operation) {
  let session;
  let result;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (error) {
    if (isUnsupportedTransaction(error)) {
      console.warn("[reputation transfer] MongoDB transactions unavailable; using idempotent transfer recovery.");
      return operation(null);
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

async function updateTransfer(id, session, update) {
  const transfer = await ReputationTransaction.findOneAndUpdate(
    { _id: id },
    update,
    { new: true, ...sessionOptions(session) },
  );
  if (!transfer)
    throw Object.assign(new Error("Transfer recovery lease was lost."), {
      status: 409,
    });
  return transfer;
}

async function findTransferEvent(userId, field, transferId, session) {
  const filter = { _id: userId, [`${field}.transferId`]: transferId };
  return withSession(User.findOne(filter).select(field), session);
}

async function recordLog(entry, session) {
  const filter = { user: entry.user, reference: entry.reference };
  try {
    await ReputationLog.updateOne(
      filter,
      { $setOnInsert: entry },
      { upsert: true, ...sessionOptions(session) },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await withSession(ReputationLog.findOne(filter), session);
    if (!existing) throw error;
  }
}

async function writeTransferLogs(transfer, sender, receiver, session) {
  const reason = transfer.reason.trim();
  await recordLog(
    {
      user: sender._id,
      userId: sender._id,
      relatedId: transfer._id,
      points: -transfer.points,
      type: "transfer-sent",
      reason: `Transferred points to ${receiver.name}: ${reason}`,
      reference: `transfer-sent:${transfer._id}`,
    },
    session,
  );
  await recordLog(
    {
      user: receiver._id,
      userId: receiver._id,
      relatedId: transfer._id,
      points: transfer.points,
      type: "transfer-received",
      reason: `Received points from ${sender.name}: ${reason}`,
      reference: `transfer-received:${transfer._id}`,
    },
    session,
  );
}

async function markFailed(transfer, session, message, stage = "pending") {
  await updateTransfer(transfer._id, session, {
    $set: { status: "failed", stage, failureReason: message },
    $unset: { leaseToken: 1, leaseUntil: 1 },
  });
  return { ok: false, status: 400, error: message };
}

async function refundSender(transfer, session) {
  const message = transfer.failureReason || "The recipient could not be credited.";
  await updateTransfer(transfer._id, session, {
    $set: { status: "processing", stage: "refund_pending", failureReason: message },
  });

  const refund = await User.findOneAndUpdate(
    {
      _id: transfer.sender,
      reputationTransferEvents: {
        $elemMatch: { transferId: transfer._id, refunded: { $ne: true } },
      },
    },
    {
      $inc: { reputation: transfer.points },
      $set: { "reputationTransferEvents.$.refunded": true },
    },
    { new: true, ...sessionOptions(session) },
  );

  if (!refund) {
    const sender = await findTransferEvent(
      transfer.sender,
      "reputationTransferEvents",
      transfer._id,
      session,
    );
    const event = sender?.reputationTransferEvents?.find(
      (item) => String(item.transferId) === String(transfer._id),
    );
    if (event && event.refunded !== true)
      throw Object.assign(new Error("Could not safely refund the transfer."), {
        status: 503,
      });
  }

  await updateTransfer(transfer._id, session, {
    $set: { status: "failed", stage: "refunded", failureReason: message },
    $unset: { leaseToken: 1, leaseUntil: 1 },
  });
  return { ok: false, status: 502, error: message };
}

async function processTransfer(id, session) {
  let transfer = await withSession(ReputationTransaction.findById(id), session);

  if (!transfer)
    throw Object.assign(new Error("Transfer record was not found."), {
      status: 404,
    });
  if (transfer.status === "completed") return { ok: true, id: String(id) };
  if (transfer.status === "failed")
    return {
      ok: false,
      status: 400,
      error: transfer.failureReason || "The transfer failed.",
    };

  if (transfer.stage === "refund_pending")
    return refundSender(transfer, session);

  let senderEvent = await findTransferEvent(
    transfer.sender,
    "reputationTransferEvents",
    transfer._id,
    session,
  );
  let debitEvent = senderEvent?.reputationTransferEvents?.find(
    (item) => String(item.transferId) === String(transfer._id),
  );

  if (!debitEvent) {
    const start = new Date(
      Date.now() - REPUTATION_TRANSFER_POLICY.rollingWindowMs,
    );
    const recentTransferSum = {
      $sum: {
        $map: {
          input: {
            $filter: {
              input: { $ifNull: ["$reputationTransferEvents", []] },
              as: "event",
              cond: {
                $and: [
                  { $gte: ["$$event.createdAt", start] },
                  { $ne: [{ $ifNull: ["$$event.refunded", false] }, true] },
                ],
              },
            },
          },
          as: "event",
          in: "$$event.points",
        },
      },
    };
    const debited = await User.findOneAndUpdate(
      {
        _id: transfer.sender,
        reputation: {
          $gte: transfer.points,
          $gt: REPUTATION_TRANSFER_POLICY.minimumBalance,
        },
        "reputationTransferEvents.transferId": { $ne: transfer._id },
        $expr: {
          $lte: [
            { $add: [recentTransferSum, transfer.points] },
            REPUTATION_TRANSFER_POLICY.maximumPointsPerRolling24Hours,
          ],
        },
      },
      {
        $inc: { reputation: -transfer.points },
        $push: {
          reputationTransferEvents: {
            transferId: transfer._id,
            points: transfer.points,
            createdAt: new Date(),
            refunded: false,
          },
        },
      },
      { new: true, ...sessionOptions(session) },
    );
    if (!debited) {
      senderEvent = await findTransferEvent(
        transfer.sender,
        "reputationTransferEvents",
        transfer._id,
        session,
      );
      debitEvent = senderEvent?.reputationTransferEvents?.find(
        (item) => String(item.transferId) === String(transfer._id),
      );
      if (!debitEvent)
        return markFailed(
          transfer,
          session,
          "Transfer unavailable: check your balance and rolling 24-hour limit.",
        );
    }
  }

  if (debitEvent?.refunded)
    return markFailed(
      transfer,
      session,
      transfer.failureReason || "The transfer was already refunded.",
      "refunded",
    );

  if (transfer.stage === "pending")
    transfer = await updateTransfer(transfer._id, session, {
      $set: { status: "processing", stage: "debited" },
    });

  let receiverEvent = await findTransferEvent(
    transfer.receiver,
    "reputationReceivedEvents",
    transfer._id,
    session,
  );
  let creditEvent = receiverEvent?.reputationReceivedEvents?.find(
    (item) => String(item.transferId) === String(transfer._id),
  );

  if (transfer.stage !== "credited" && !creditEvent) {
    const credited = await User.findOneAndUpdate(
      {
        _id: transfer.receiver,
        "reputationReceivedEvents.transferId": { $ne: transfer._id },
      },
      {
        $inc: { reputation: transfer.points },
        $push: {
          reputationReceivedEvents: {
            transferId: transfer._id,
            points: transfer.points,
            createdAt: new Date(),
          },
        },
      },
      { new: true, ...sessionOptions(session) },
    );
    if (!credited) {
      receiverEvent = await findTransferEvent(
        transfer.receiver,
        "reputationReceivedEvents",
        transfer._id,
        session,
      );
      creditEvent = receiverEvent?.reputationReceivedEvents?.find(
        (item) => String(item.transferId) === String(transfer._id),
      );
      if (!creditEvent) {
        transfer.failureReason = "The recipient account could not be credited.";
        return refundSender(transfer, session);
      }
    }
  }

  if (transfer.stage !== "credited")
    transfer = await updateTransfer(transfer._id, session, {
      $set: { status: "processing", stage: "credited" },
    });

  const [sender, receiver] = await Promise.all([
    withSession(User.findById(transfer.sender).select("name"), session),
    withSession(User.findById(transfer.receiver).select("name"), session),
  ]);
  if (!sender || !receiver) {
    transfer.failureReason = "A transfer participant is no longer available.";
    return refundSender(transfer, session);
  }

  await writeTransferLogs(transfer, sender, receiver, session);
  await updateTransfer(transfer._id, session, {
    $set: { status: "completed", stage: "credited" },
    $unset: { leaseToken: 1, leaseUntil: 1 },
  });
  return { ok: true, id: String(transfer._id) };
}

export async function reconcilePendingReputationTransfers({ userId, limit = 50 } = {}) {
  await connectDB();
  const now = new Date();
  const query = {
    $or: [
      { status: "pending" },
      {
        status: "processing",
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: null },
          { leaseUntil: { $lte: now } },
        ],
      },
    ],
  };
  if (userId) {
    const userIds = Array.isArray(userId) ? userId : [userId];
    query.$and = [
      { $or: userIds.flatMap((id) => [{ sender: id }, { receiver: id }]) },
    ];
  }

  const pending = await ReputationTransaction.find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .select("_id");
  let resumed = 0;
  let deferred = 0;
  for (const transaction of pending) {
    try {
      const result = await runTransferTransaction((session) =>
        processTransfer(transaction._id, session),
      );
      if (result.ok || result.status !== 409) resumed += 1;
      else deferred += 1;
    } catch (error) {
      deferred += 1;
      console.error("[reputation transfer] recovery deferred", {
        transferId: String(transaction._id),
        message: error.message,
      });
    }
  }
  return { resumed, deferred };
}

export async function cleanupReputationTransferMarkers() {
  await connectDB();
  const cutoff = new Date(
    Date.now() - REPUTATION_TRANSFER_POLICY.rollingWindowMs,
  );
  const activeTransfers = await ReputationTransaction.find({
    status: { $in: ["pending", "processing"] },
  })
    .select("_id")
    .lean();
  const activeIds = activeTransfers.map((transfer) => transfer._id);
  await User.updateMany(
    {},
    {
      $pull: {
        reputationTransferEvents: {
          createdAt: { $lt: cutoff },
          transferId: { $nin: activeIds },
        },
        reputationReceivedEvents: { transferId: { $nin: activeIds } },
      },
    },
  );
}

export async function transferReputation(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["receiver", "reason"]);
    const points = Number(body.points);
    const initialValidation = getTransferValidationError({
      senderReputation: user.reputation,
      points,
    });
    if (initialValidation)
      throw Object.assign(new Error(initialValidation.message), {
        status: initialValidation.status,
      });
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 250) : "";
    if (!reason)
      throw Object.assign(new Error("A transfer reason is required."), { status: 400 });

    await connectDB();
    const receiverInput = typeof body.receiver === "string" ? body.receiver.trim() : "";
    const receiver = receiverInput
      ? await User.findOne(
          receiverInput.includes("@")
            ? { email: receiverInput.toLowerCase() }
            : { _id: receiverInput },
        ).select("_id")
      : null;
    if (!receiver || String(receiver._id) === String(user._id))
      throw Object.assign(new Error("Choose another existing member."), { status: 400 });

    await reconcilePendingReputationTransfers({
      userId: [user._id, receiver._id],
      limit: 10,
    });

    let result;
    const createAndProcess = async (session) => {
      const now = new Date();
      const start = new Date(
        now.getTime() - REPUTATION_TRANSFER_POLICY.rollingWindowMs,
      );
      const dailyAggregate = ReputationTransaction.aggregate([
        {
          $match: {
            sender: user._id,
            createdAt: { $gte: start },
            status: { $ne: "failed" },
          },
        },
        { $group: { _id: null, points: { $sum: "$points" } } },
      ]);
      const dailyTotal = await (
        session ? dailyAggregate.session(session) : dailyAggregate
      );
      const validationError = getTransferValidationError({
        senderReputation: user.reputation,
        points,
        dailyTotal: dailyTotal[0]?.points || 0,
      });
      if (validationError)
        throw Object.assign(
          new Error(validationError.message),
          { status: validationError.status },
        );

      const transferId = new mongoose.Types.ObjectId();
      const documents = await ReputationTransaction.create(
        [
          {
            _id: transferId,
            sender: user._id,
            receiver: receiver._id,
            points,
            reason,
            status: "pending",
            stage: "pending",
          },
        ],
        sessionOptions(session),
      );
      result = await processTransfer(documents[0]._id, session);
    };

    await runTransferTransaction(createAndProcess);
    if (!result?.ok)
      throw Object.assign(new Error(result?.error || "The transfer is still processing."), {
        status: result?.status || 503,
      });
    return NextResponse.json({ ok: true, transferId: result.id });
  } catch (error) {
    return errorResponse(error);
  }
}