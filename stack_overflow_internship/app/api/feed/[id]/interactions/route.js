import { handleFeedAction } from "@/lib/feed-interactions";

export const runtime = "nodejs";

export async function POST(request, context) {
  return handleFeedAction(request, context);
}
