import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Follow, Notification, User } from "@/lib/models";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    if (body.action !== "follow")
      throw Object.assign(new Error("Unsupported action."), { status: 400 });
    await connectDB();
    const target = await User.findById(body.userId);
    if (!target || String(target._id) === String(user._id))
      throw Object.assign(new Error("Invalid follow target."), { status: 400 });
    const existing = await Follow.findOne({
      follower: user._id,
      following: target._id,
    });
    if (existing) {
      await existing.deleteOne();
      return NextResponse.json({ following: false });
    }
    await Follow.create({ follower: user._id, following: target._id });
    await Notification.create({
      recipient: target._id,
      actor: user._id,
      type: "follow",
    });
    return NextResponse.json({ following: true });
  } catch (error) {
    return errorResponse(error);
  }
}
