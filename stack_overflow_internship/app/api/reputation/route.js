import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { ReputationLog, ReputationTransaction } from "@/lib/models";
import { transferReputation } from "@/lib/reputation-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const [logs, transactions] = await Promise.all([
      ReputationLog.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
      ReputationTransaction.find({ $or: [{ sender: user._id }, { receiver: user._id }] })
        .sort({ createdAt: -1 })
        .populate("sender", "name")
        .populate("receiver", "name")
        .lean(),
    ]);
    return NextResponse.json({ reputation: user.reputation, logs, transactions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  return transferReputation(request);
}
