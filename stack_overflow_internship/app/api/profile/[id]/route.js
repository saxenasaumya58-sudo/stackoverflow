import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { ReputationLog, User } from "@/lib/models";
import { getCurrentSubscription } from "@/lib/subscriptions";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  try {
    await connectDB();
    const user =
      params.id === "me"
        ? (await import("@/lib/auth")).getAuth().then((auth) => auth.user)
        : User.findById(params.id);
    const found = await user;
    if (!found)
      throw Object.assign(new Error("Profile not found."), { status: 404 });
    const [profile, reputation, subscription] = await Promise.all([
      User.findById(found._id).select(
        "name bio location website avatarUrl reputation createdAt",
      ),
      ReputationLog.find({ user: found._id })
        .sort({ createdAt: -1 })
        .lean(),
      getCurrentSubscription(found._id),
    ]);
    return NextResponse.json({ user: profile, reputation, subscription });
  } catch (error) {
    return errorResponse(error);
  }
}
