import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Follow, User } from "@/lib/models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuth({ required: false });
    if (!auth) return NextResponse.json({ suggestions: [] });
    const { user } = auth;
    await connectDB();
    const follows = await Follow.find({ follower: user._id }).distinct("following");
    const suggestions = await User.find({ _id: { $nin: [user._id, ...follows] }, suspendedAt: null })
      .select("name bio reputation avatarUrl location")
      .sort({ reputation: -1 })
      .limit(5)
      .lean();
    return NextResponse.json({ suggestions });
  } catch (error) {
    return errorResponse(error);
  }
}