import "server-only";
import { ReputationLog, User } from "@/lib/models";
import {
  hasReputationPrivilege,
  REPUTATION_PRIVILEGES,
} from "@/lib/reputation-policy.mjs";

export { REPUTATION_PRIVILEGES };
export const privilegeThresholds = Object.values(REPUTATION_PRIVILEGES);

export function checkPrivilege(
  points,
  minimum = REPUTATION_PRIVILEGES.comment,
) {
  return (
    privilegeThresholds.includes(minimum) &&
    hasReputationPrivilege(points, minimum)
  );
}

export async function addReputation(
  userId,
  points,
  reason,
  reference,
  relatedId = null,
  logType,
) {
  if (!Number.isInteger(points) || !reason || !reference)
    throw new TypeError(
      "A reputation change requires integer points, a reason, and a reference.",
    );

  let log;
  try {
    log = await ReputationLog.create({
      userId,
      user: userId,
      relatedId: relatedId || null,
      points,
      type: logType || (points < 0 ? "deduction" : "award"),
      reason,
      reference,
      balanceApplied: false,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existingLog = await ReputationLog.collection.findOne(
      {
        user: userId,
        reason,
        reference,
      },
      { projection: { balanceApplied: 1 } },
    );
    if (!existingLog) throw error;
    log = await ReputationLog.findById(existingLog._id).select("+balanceApplied");
    if (existingLog.balanceApplied !== false)
      log.balanceApplied = true;
  }

  if (!log.balanceApplied) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        "reputationAwardEvents.reference": { $ne: reference },
      },
      [
        {
          $set: {
            reputation: {
              $max: [0, { $add: [{ $ifNull: ["$reputation", 0] }, points] }],
            },
            reputationAwardEvents: {
              $concatArrays: [
                { $ifNull: ["$reputationAwardEvents", []] },
                [{ reference }],
              ],
            },
          },
        },
      ],
      { new: true },
    );

    if (!updatedUser) {
      const eventExists = await User.exists({
        _id: userId,
        "reputationAwardEvents.reference": reference,
      });
      if (!eventExists)
        throw new Error("The reputation change could not be applied to the user.");
    }

    const appliedLog = await ReputationLog.updateOne(
      { _id: log._id, balanceApplied: false },
      { $set: { balanceApplied: true } },
    );
    if (appliedLog.matchedCount !== 1) {
      const currentLog = await ReputationLog.findById(log._id)
        .select("+balanceApplied")
        .lean();
      if (!currentLog?.balanceApplied)
        throw new Error("The reputation activity could not be finalized.");
    }
    log.balanceApplied = true;
  }

  return log;
}