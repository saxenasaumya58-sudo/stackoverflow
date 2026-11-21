import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Answer, CloseVote, Question } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    if (!mongoose.isValidObjectId(params.id))
      throw Object.assign(new Error("Question not found."), { status: 404 });
    await connectDB();
    const question = await Question.findById(params.id)
      .populate("author", "name reputation")
      .lean();
    if (!question || question.status === "removed")
      throw Object.assign(new Error("Question not found."), { status: 404 });
    const [answers, closeVotes] = await Promise.all([
      Answer.find({ question: question._id })
        .sort({ accepted: -1, upvotes: -1, createdAt: 1 })
        .populate("author", "name reputation")
        .lean(),
      CloseVote.countDocuments({ question: question._id }),
    ]);
    return NextResponse.json({ question, answers, closeVotes });
  } catch (error) {
    return errorResponse(error);
  }
}
