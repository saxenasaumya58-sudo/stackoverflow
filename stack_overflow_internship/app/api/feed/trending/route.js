import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getTrendingPosts } from "@/lib/feed-query";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const auth = await getAuth({ required: false });
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
    const tag = (params.get("tag") || "").replace(/^#/, "").toLowerCase();
    return NextResponse.json(await getTrendingPosts({
      page,
      limit,
      tag,
      currentUserId: auth?.user._id,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}