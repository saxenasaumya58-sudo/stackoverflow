import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Bookmark } from "@/lib/models";
import { handleFeedAction } from "@/lib/feed-interactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const bookmarks = await Bookmark.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate({ path: "postId", populate: { path: "author", select: "name avatarUrl" } })
      .lean();
    return NextResponse.json({ bookmarks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  return handleFeedAction(request, {}, "bookmark");
}

export async function DELETE(request) {
  try {
    const { user } = await getAuth();
    const { postId } = await request.json();
    if (!postId)
      throw Object.assign(new Error("postId is required."), { status: 400 });
    await connectDB();
    await Bookmark.deleteOne({ userId: user._id, postId });
    return NextResponse.json({ bookmarked: false });
  } catch (error) {
    return errorResponse(error);
  }
}