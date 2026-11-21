import { handleFeedAction } from "@/lib/feed-interactions";

export const runtime = "nodejs";
export async function POST(request) {
  return handleFeedAction(request, {}, "comment");
}