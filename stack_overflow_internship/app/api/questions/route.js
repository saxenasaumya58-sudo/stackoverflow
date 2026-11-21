import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Question } from "@/lib/models";
import { plans } from "@/lib/plans";
import { getCurrentSubscription } from "@/lib/subscriptions";
export const runtime = "nodejs";

async function getQuestionQuota(userId) {
  const active = await getCurrentSubscription(userId);
  const currentPlan = plans.find((plan) => plan.slug === active?.plan) || plans[0];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await Question.countDocuments({
    author: userId,
    createdAt: { $gte: since },
  });
  const limit = currentPlan.dailyQuestions;
  return {
    plan: currentPlan.slug,
    used,
    limit,
    remaining: limit === -1 ? null : Math.max(0, limit - used),
    limitReached: limit !== -1 && used >= limit,
  };
}

export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const [quota, questions] = await Promise.all([
      getQuestionQuota(user._id),
      Question.find({ status: { $ne: "removed" } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("author", "name reputation")
        .lean(),
    ]);
    return NextResponse.json({ ...quota, questions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["title", "body"]);
    if (
      typeof body.title !== "string" ||
      typeof body.body !== "string" ||
      !body.title.trim() ||
      !body.body.trim() ||
      body.title.length > 180 ||
      body.body.length > 10000
    )
      throw Object.assign(new Error("Question is too long."), { status: 400 });
    await connectDB();
    const quota = await getQuestionQuota(user._id);
    if (quota.limitReached)
      throw Object.assign(
        new Error("Daily limit reached. Upgrade your plan to post more questions."),
        { status: 403 },
      );
    const question = await Question.create({
      author: user._id,
      title: body.title.trim(),
      body: body.body.trim(),
      isFeatured: quota.plan === "gold",
      boostScore: quota.plan === "gold" ? 10 : 0,
    });
    const used = quota.used + 1;
    const updatedQuota = {
      ...quota,
      used,
      remaining:
        quota.limit === -1 ? null : Math.max(0, quota.limit - used),
      limitReached: quota.limit !== -1 && used >= quota.limit,
    };
    return NextResponse.json(
      { question, quota: updatedQuota },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
