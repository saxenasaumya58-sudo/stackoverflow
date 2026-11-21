import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Answer, Question } from "@/lib/models";
import { awardReputation } from "@/lib/services";
import { REPUTATION_AWARDS } from "@/lib/reputation-policy.mjs";
export const runtime = "nodejs";
export async function POST(request, { params }) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    if (!body.answerId)
      throw Object.assign(new Error("answerId is required."), { status: 400 });
    await connectDB();
    const question = await Question.findOne({
      _id: params.id,
      author: user._id,
    });
    if (!question)
      throw Object.assign(
        new Error("Only the question author can accept an answer."),
        { status: 403 },
      );
    const answer = await Answer.findOneAndUpdate(
      { _id: body.answerId, question: question._id },
      { $set: { accepted: true } },
      { new: true },
    );
    if (!answer)
      throw Object.assign(new Error("Answer not found."), { status: 404 });
    await Answer.updateMany(
      { question: question._id, _id: { $ne: answer._id } },
      { $set: { accepted: false } },
    );
    question.status = "answered";
    await question.save();
    await awardReputation(
      answer.author,
      REPUTATION_AWARDS.answerAccepted,
      "Answer marked as accepted",
      `answer-accepted:${answer._id}`,
      answer._id,
    );
    return NextResponse.json({ answer });
  } catch (error) {
    return errorResponse(error);
  }
}
