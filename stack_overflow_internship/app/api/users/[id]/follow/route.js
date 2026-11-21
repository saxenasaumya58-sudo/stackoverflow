import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Follow, Notification, User } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const profileId = params.id === "me" ? user._id : params.id;
    const [followed, followersCount, followingCount] = await Promise.all([
      Follow.exists({ follower: user._id, following: profileId }),
      Follow.countDocuments({ following: profileId }),
      Follow.countDocuments({ follower: profileId }),
    ]);
    return NextResponse.json({
      followed: Boolean(followed),
      followersCount,
      followingCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const target = await User.findOne({ _id: params.id, suspendedAt: null });
    if (!target || String(target._id) === String(user._id))
      throw Object.assign(new Error("Invalid follow target."), { status: 400 });

    const existing = await Follow.findOne({
      follower: user._id,
      following: target._id,
    });
    if (existing) {
      await existing.deleteOne();
      return NextResponse.json({ followed: false });
    }

    await Follow.create({ follower: user._id, following: target._id });
    await Notification.create({
      recipient: target._id,
      actor: user._id,
      type: "follow",
    });
    return NextResponse.json({ followed: true });
  } catch (error) {
    return errorResponse(error);
  }
}