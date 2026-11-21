import { NextResponse } from "next/server";
import { requireReputation } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Post, Report, User } from "@/lib/models";
import { REPUTATION_PRIVILEGES } from "@/lib/reputation-policy.mjs";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const user = await requireReputation(
      REPUTATION_PRIVILEGES.reportInappropriateContent,
    );
    const body = await request.json();
    requireFields(body, ["reason"]);
    if (typeof body.reason !== "string" || !body.reason.trim())
      throw Object.assign(new Error("A report reason is required."), {
        status: 400,
      });

    await connectDB();
    const post = await Post.findOne({ _id: params.id, status: "active" });
    if (!post)
      throw Object.assign(new Error("Post not found."), { status: 404 });

    await Report.create({
      post: post._id,
      reportedBy: user._id,
      reason: body.reason.trim().slice(0, 500),
      status: "pending",
    });

    const authorPostIds = await Post.distinct("_id", { author: post.author });
    const reportCount = await Report.countDocuments({
      post: { $in: authorPostIds },
    });
    if (reportCount > 3) {
      await User.updateOne(
        { _id: post.author },
        { $set: { isSuspended: true, suspendedAt: new Date() } },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}