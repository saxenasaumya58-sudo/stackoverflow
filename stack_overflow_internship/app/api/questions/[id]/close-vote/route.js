import { NextResponse } from "next/server";
import { requireReputation } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { CloseVote, Question } from "@/lib/models";
import { REPUTATION_PRIVILEGES } from "@/lib/reputation-policy.mjs";
export const runtime = "nodejs";
export async function POST(request, { params }) {
  try {
    const user = await requireReputation(
      REPUTATION_PRIVILEGES.closeQuestion,
    );
    await connectDB();
    const question = await Question.findOne({ _id: params.id, status: "open" });
    if (!question)
      throw Object.assign(new Error("Open question not found."), {
        status: 404,
      });
    try {
      await CloseVote.create({ question: question._id, user: user._id });
    } catch (error) {
      if (error.code === 11000)
        throw Object.assign(new Error("You have already voted to close this question."), {
          status: 409,
        });
      throw error;
    }
    const votes = await CloseVote.countDocuments({ question: question._id });
    if (votes >= 3) {
      question.status = "closed";
      await question.save();
    }
    return NextResponse.json({ votes, closed: votes >= 3 });
  } catch (error) {
    return errorResponse(error);
  }
}
