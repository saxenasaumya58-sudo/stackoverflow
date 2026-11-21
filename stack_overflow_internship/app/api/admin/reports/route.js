import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Post, Report, User } from "@/lib/models";
import { awardReputation } from "@/lib/services";
import { REPUTATION_AWARDS } from "@/lib/reputation-policy.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function admin() {
  const { user } = await getAuth();
  if (user.role !== "admin")
    throw Object.assign(new Error("Admin access is required."), {
      status: 403,
    });
  return user;
}
export async function GET() {
  try {
    await admin();
    await connectDB();
    const reports = await Report.find({ status: { $in: ["pending", "open"] } })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("reportedBy", "name email")
      .populate("reporter", "name")
      .populate({
        path: "post",
        populate: {
          path: "author",
          select: "name isSuspended suspendedAt",
        },
      })
      .lean();
    return NextResponse.json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request) {
  try {
    const moderator = await admin();
    const body = await request.json();
    requireFields(body, ["reportId", "action"]);
    const action = body.action === "remove" ? "removePost" : body.action;
    if (!["removePost", "dismiss"].includes(action))
      throw Object.assign(new Error("Choose dismiss or removePost."), { status: 400 });
    await connectDB();
    const report = await Report.findOne({
      _id: body.reportId,
      status: { $in: ["pending", "open"] },
    }).populate("post");
    if (!report)
      throw Object.assign(new Error("Report not found."), { status: 404 });
    report.status = action === "removePost" ? "removed" : "reviewed";
    report.reviewedBy = moderator._id;
    report.reviewedAt = new Date();
    await report.save();
    if (action === "removePost") {
      await Post.updateOne(
        { _id: report.post._id },
        { $set: { status: "removed", isDeleted: true } },
      );
      const authorId = report.post.author;
      await awardReputation(
        authorId,
        REPUTATION_AWARDS.adminContentRemoved,
        "Content removed by admin due to violation",
        `admin-post-remove:${report.post._id}`,
        report.post._id,
      );
      const removedCount = await Post.countDocuments({
        author: authorId,
        status: "removed",
      });
      if (removedCount >= 2)
        await User.updateOne(
          { _id: authorId, isSuspended: { $ne: true }, suspendedAt: null },
          { $set: { isSuspended: true, suspendedAt: new Date() } },
        );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
