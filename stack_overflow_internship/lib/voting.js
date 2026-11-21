import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Answer, Question, Vote } from "@/lib/models";
import { awardReputation } from "@/lib/services";
import {
  getUpvoteMilestoneAward,
  REPUTATION_AWARDS,
  REPUTATION_MILESTONES,
} from "@/lib/reputation-policy.mjs";

export async function handleVote(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["targetType", "target"]);
    const value = Number(body.value);
    if (!["question", "answer"].includes(body.targetType) || ![-1, 1].includes(value))
      throw Object.assign(new Error("Vote must be +1 or -1 on a question or answer."), { status: 400 });

    await connectDB();
    const Target = body.targetType === "question" ? Question : Answer;
    const target = await Target.findById(body.target);
    if (!target)
      throw Object.assign(new Error("Item not found."), { status: 404 });
    if (String(target.author) === String(user._id))
      throw Object.assign(new Error("You cannot vote on your own post."), { status: 400 });
    try {
      await Vote.create({
        user: user._id,
        targetType: body.targetType,
        target: target._id,
        value,
      });
    } catch (error) {
      if (error.code === 11000)
        throw Object.assign(
          new Error("You have already voted on this item."),
          { status: 409 },
        );
      throw error;
    }

    const increments = value === 1 ? { upvotes: 1 } : { downvotes: 1 };
    const updatedTarget = await Target.findByIdAndUpdate(
      target._id,
      { $inc: increments },
      { new: true },
    );
    if (!updatedTarget)
      throw Object.assign(new Error("Item not found."), { status: 404 });

    if (body.targetType === "answer") {
      if (value === -1)
        await awardReputation(
          target.author,
          REPUTATION_AWARDS.downvoteReceived,
          "Received a downvote",
          `answer-downvote:${user._id}:${target._id}`,
          target._id,
          "downvote_received",
        );
      const milestoneAward = getUpvoteMilestoneAward(
        {
          targetType: "answer",
          previousUpvotes: target.upvotes,
          currentUpvotes: updatedTarget.upvotes,
          answerBonusAlreadyAwarded: Boolean(updatedTarget.bonusAwardedAt),
        },
      );
      if (milestoneAward) {
        await awardReputation(
          target.author,
          milestoneAward,
          `Answer received ${REPUTATION_MILESTONES.answerUpvotes} upvotes`,
          `answer-five-upvotes:${target._id}`,
          target._id,
        );
        updatedTarget.bonusAwardedAt = new Date();
        await updatedTarget.save();
      }
    } else {
      if (value === -1)
        await awardReputation(
          target.author,
          REPUTATION_AWARDS.downvoteReceived,
          "Received a question downvote",
          `question-downvote:${user._id}:${target._id}`,
          target._id,
          "downvote_received",
        );
      const milestoneAward = getUpvoteMilestoneAward(
        {
          targetType: "question",
          previousUpvotes: target.upvotes,
          currentUpvotes: updatedTarget.upvotes,
        },
      );
      if (milestoneAward)
        await awardReputation(
          target.author,
          milestoneAward,
          `Question received ${REPUTATION_MILESTONES.questionUpvotes} upvotes`,
          `question-ten-upvotes:${target._id}`,
          target._id,
        );
    }
    return NextResponse.json({
      ok: true,
      upvotes: updatedTarget.upvotes,
      downvotes: updatedTarget.downvotes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
