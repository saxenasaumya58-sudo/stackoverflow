import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Plan, Post, Question } from "@/lib/models";
import { plans } from "@/lib/plans";
import { getCurrentSubscription, requirePremium } from "@/lib/subscriptions";
import { authorSubscriptionPriorityStages } from "@/lib/search-priority";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") || "").trim().slice(0, 100);
    const type = params.get("type");
    const since = params.get("since");
    const tag = (params.get("tag") || "").replace(/^#/, "").slice(0, 40).trim().toLowerCase();
    const minVotes = Number(params.get("votes") || 0);
    const wantsAdvanced = !!(type || since || tag || minVotes > 0);
    const auth = await getAuth({ required: false });
    let plan = plans[0];
    await connectDB();
    if (auth && !wantsAdvanced) {
      const active = await getCurrentSubscription(auth.user._id);
      if (active?.plan)
        plan = plans.find((item) => item.slug === active.plan) || plans[0];
    }
    if (wantsAdvanced) {
      if (!auth)
        throw Object.assign(
          new Error("Advanced search filters are available with Bronze and above."),
          { status: 403 },
        );
      const active = await requirePremium(auth.user._id);
      plan = plans.find((item) => item.slug === active.plan) || plans[0];
    }
    if (wantsAdvanced && plan.searchPriority < 1)
      throw Object.assign(
        new Error(
          "Advanced search filters are available with Bronze and above.",
        ),
        { status: 403 },
      );
    if (plan.searchPriority === 0) {
      const titleFilter = {};
      if (query) {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        titleFilter.title = { $regex: escaped, $options: "i" };
      }
      const questions = await Question.aggregate([
        { $match: titleFilter },
        ...authorSubscriptionPriorityStages(),
        { $sort: { isFeatured: -1, boostScore: -1, createdAt: -1 } },
        { $limit: 30 },
        {
          $lookup: {
            from: "users",
            let: { authorId: "$author" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$authorId"] } } },
              { $project: { name: 1, reputation: 1, avatarUrl: 1 } },
            ],
            as: "author",
          },
        },
        { $unwind: "$author" },
        { $unset: ["authorPlanPriority", "authorSubscription"] },
      ]);
      return NextResponse.json({
        posts: questions.map((question) => ({
          ...question,
          userId: question.author?._id || question.author,
          content: question.title,
          type: "question",
          hashtags: [],
        })),
        plan: plan.slug,
        advancedSearch: false,
      });
    }
    const filter = { status: "active" };
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { content: { $regex: escaped, $options: "i" } },
        { hashtags: { $regex: escaped, $options: "i" } },
      ];
    }
    if (tag) filter.hashtags = tag;
    if (type) filter.type = type;
    if (minVotes > 0) filter.likesCount = { $gte: minVotes };
    if (since) {
      const date = new Date(since);
      if (Number.isNaN(date.getTime()))
        throw Object.assign(new Error("Choose a valid date filter."), {
          status: 400,
        });
      filter.createdAt = { $gte: date };
    }
    const posts = await Post.aggregate([
      { $match: filter },
      ...authorSubscriptionPriorityStages(),
      { $sort: { isFeatured: -1, boostScore: -1, createdAt: -1 } },
      { $limit: 30 },
      {
        $lookup: {
          from: "users",
          let: { authorId: "$author" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$authorId"] } } },
            { $project: { name: 1, reputation: 1, avatarUrl: 1 } },
          ],
          as: "author",
        },
      },
      { $unwind: "$author" },
      { $unset: ["authorPlanPriority", "authorSubscription"] },
    ]);
    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        userId: post.userId || post.author?._id || post.author,
      })),
      plan: plan.slug,
      advancedSearch: plan.searchPriority >= 1,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
