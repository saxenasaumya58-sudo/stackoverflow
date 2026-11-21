import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { getFeedPage, getTrendingTags } from "@/lib/feed-query";
import { Post } from "@/lib/models";
import { getCurrentSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const requestedPage = Number(params.get("page") || 1);
    const requestedLimit = Number(params.get("limit") || 10);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(10, requestedLimit)
        : 10;
    const requestedHashtag = params.get("hashtag") || params.get("tag");
    const hashtag = requestedHashtag?.trim().replace(/^#/, "").toLowerCase();
    const filter = params.get("filter") || (params.get("following") === "true" ? "following" : "all");
    const auth = await getAuth({ required: filter === "following" });
    const currentUserId = auth?.user._id;
    const result = await getFeedPage({
      page,
      limit,
      hashtag,
      sort: params.get("sort") || (filter === "trending" ? "trending" : ""),
      filter,
      followingUserId: filter === "following" ? currentUserId : undefined,
      currentUserId,
    });
    if (params.get("includeTags") === "true") {
      result.trendingTags = await getTrendingTags({ limit: 12 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const auth = await getAuth();
    const body = await request.json();
    requireFields(body, ["content", "type"]);
    if (body.content.length > 5000 || body.code?.length > 20000)
      throw Object.assign(new Error("Post content is too long."), {
        status: 400,
      });
    if (
      ![
        "technical update",
        "image",
        "code snippet",
        "project showcase",
        "learning achievement",
      ].includes(body.type)
    )
      throw Object.assign(new Error("Invalid post type."), { status: 400 });
    await connectDB();
    const hashtags = [
      ...new Set(
        [...body.content.matchAll(/#([a-zA-Z0-9_]+)/g)].map((match) =>
          match[1].toLowerCase(),
        ),
      ),
    ];
    if (body.imageUrl) {
      let image;
      try {
        image = new URL(body.imageUrl);
      } catch {
        throw Object.assign(new Error("Image URL is invalid."), { status: 400 });
      }
      if (
        image.protocol !== "https:" ||
        image.hostname !== "res.cloudinary.com" ||
        !image.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/`)
      )
        throw Object.assign(
          new Error("Post images must use an uploaded Cloudinary image."),
          { status: 400 },
        );
    }
    const subscription = await getCurrentSubscription(auth.user._id);
    const post = await Post.create({
      userId: auth.user._id,
      author: auth.user._id,
      type: body.type,
      content: body.content.trim(),
      imageUrl: body.imageUrl || "",
      code: body.code || "",
      hashtags,
      isFeatured: subscription?.plan === "gold",
      boostScore: subscription?.plan === "gold" ? 10 : subscription?.plan === "silver" ? 1 : 0,
    });
    const populated = await post.populate(
      "author",
      "name reputation avatarUrl",
    );
    return NextResponse.json({ post: populated });
  } catch (error) {
    return errorResponse(error);
  }
}
