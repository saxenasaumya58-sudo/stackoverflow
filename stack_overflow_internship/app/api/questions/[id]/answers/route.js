import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Answer, Question } from "@/lib/models";
import { awardReputation } from "@/lib/services";
import { REPUTATION_AWARDS } from "@/lib/reputation-policy.mjs";
export const runtime = "nodejs";
export async function POST(request, { params }) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["body"]);
    if (typeof body.body !== "string" || !body.body.trim() || body.body.length > 10000)
      throw Object.assign(new Error("Answer must be between 1 and 10,000 characters."), {
        status: 400,
      });
    await connectDB();
    const question = await Question.findById(params.id);
    if (!question || question.status !== "open")
      throw Object.assign(new Error("Question is unavailable."), {
        status: 404,
      });
    const answer = await Answer.create({
      question: question._id,
      author: user._id,
      body: body.body.trim(),
    });
    await awardReputation(
      user._id,
      REPUTATION_AWARDS.answerPosted,
      "Posted an answer",
      `answer-posted:${answer._id}`,
      answer._id,
    );
    return NextResponse.json({ answer }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request, { params }) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    if (!body.answerId)
      throw Object.assign(new Error("answerId is required."), { status: 400 });
    await connectDB();
    const answer = await Answer.findOneAndDelete({
      _id: body.answerId,
      question: params.id,
      author: user._id,
    });
    if (!answer)
      throw Object.assign(new Error("Answer not found or you do not own it."), {
        status: 404,
      });
    if (answer.accepted) {
      const question = await Question.findById(answer.question);
      if (question) ((question.status = "open"), await question.save());
    }
    await awardReputation(
      user._id,
      REPUTATION_AWARDS.answerDeleted,
      "Deleted an answer",
      `answer-deleted:${answer._id}`,
      answer._id,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
