import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Follow, Notification, User } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const params = new URL(request.url).searchParams;
    if (params.get("following") === "true") {
      const followingIds = await Follow.find({ follower: user._id }).distinct(
        "following",
      );
      return NextResponse.json({ followingIds: followingIds.map(String) });
    }
    const requestedPage = Number(params.get("page") || 1);
    const requestedLimit = Number(params.get("limit") || 15);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(15, requestedLimit)
        : 15;
    const users = await User.find({ _id: { $ne: user._id }, suspendedAt: null })
      .select("name email reputation bio location createdAt")
      .sort({ reputation: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean();
    const hasMore = users.length > limit;
    if (hasMore) users.pop();
    const followingIds = await Follow.find({
      follower: user._id,
      following: { $in: users.map((person) => person._id) },
    })
      .select("following")
      .lean();
    const following = new Set(followingIds.map((item) => String(item.following)));
    return NextResponse.json({
      users: users.map((person) => ({ ...person, following: following.has(String(person._id)) })),
      page,
      limit,
      hasMore,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["userId"]);
    await connectDB();
    const target = await User.findOne({ _id: body.userId, suspendedAt: null });
    if (!target || String(target._id) === String(user._id)) {
      throw Object.assign(new Error("Choose a valid community member."), { status: 400 });
    }
    const existing = await Follow.findOne({ follower: user._id, following: target._id });
    if (existing) {
      await existing.deleteOne();
      return NextResponse.json({ following: false });
    }
    await Follow.create({ follower: user._id, following: target._id });
    await Notification.create({ recipient: target._id, actor: user._id, type: "follow" });
    return NextResponse.json({ following: true });
  } catch (error) {
    return errorResponse(error);
  }
}