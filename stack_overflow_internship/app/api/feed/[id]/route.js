import { NextResponse } from "next/server";
import { getAuth, requireReputation } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Post } from "@/lib/models";
import { REPUTATION_PRIVILEGES } from "@/lib/reputation-policy.mjs";

export const runtime = "nodejs";
export async function PATCH(request, { params }) {
  try {
    const user = await requireReputation(
      REPUTATION_PRIVILEGES.editCommunityPost,
    );
    const body = await request.json();
    await connectDB();
    const post = await Post.findOne({
      _id: params.id,
      author: user._id,
      status: "active",
    });
    if (!post)
      throw Object.assign(new Error("Post not found or you do not own it."), {
        status: 404,
      });
    if (
      typeof body.content !== "string" ||
      !body.content.trim() ||
      body.content.length > 5000
    )
      throw Object.assign(
        new Error(
          "Post content is required and must be under 5,000 characters.",
        ),
        { status: 400 },
      );
    post.content = body.content.trim();
    post.hashtags = [
      ...new Set(
        [...post.content.matchAll(/#([a-zA-Z0-9_]+)/g)].map((match) =>
          match[1].toLowerCase(),
        ),
      ),
    ];
    post.editedAt = new Date();
    await post.save();
    return NextResponse.json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request, context) {
  return PATCH(request, context);
}
export async function DELETE(request, { params }) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const post = await Post.findOneAndUpdate(
      { _id: params.id, author: user._id, status: "active" },
      { $set: { status: "removed", isDeleted: true } },
    );
    if (!post)
      throw Object.assign(new Error("Post not found or you do not own it."), {
        status: 404,
      });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
