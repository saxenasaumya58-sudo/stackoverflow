import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Comment, Post } from "@/lib/models";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  try {
    await connectDB();
    const post = await Post.findOne({ _id: params.id, status: "active" });
    if (!post)
      throw Object.assign(new Error("Post not found."), { status: 404 });
    const requestedPage = Number(
      new URL(request.url).searchParams.get("page") || 1,
    );
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
    const limit = 15;
    const comments = await Comment.find({ post: post._id })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .populate("author", "name reputation")
      .lean();
    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();
    return NextResponse.json({ comments, page, limit, hasMore });
  } catch (error) {
    return errorResponse(error);
  }
}
