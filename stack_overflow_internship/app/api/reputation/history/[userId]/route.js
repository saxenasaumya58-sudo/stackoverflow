import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { ReputationLog, ReputationTransaction, User } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await connectDB();
    const target = params.userId === "me"
      ? (await getAuth()).user
      : await User.findById(params.userId).select("reputation");
    if (!target)
      throw Object.assign(new Error("Profile not found."), { status: 404 });

    const [logs, transactions] = await Promise.all([
      ReputationLog.find({ user: target._id }).sort({ createdAt: -1 }).lean(),
      ReputationTransaction.find({
        $or: [{ sender: target._id }, { receiver: target._id }],
      })
        .sort({ createdAt: -1 })
        .populate("sender", "name")
        .populate("receiver", "name")
        .lean(),
    ]);
    return NextResponse.json({
      userId: String(target._id),
      reputation: target.reputation,
      logs,
      transactions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}