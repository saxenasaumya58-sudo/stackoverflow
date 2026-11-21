import { handleVote } from "@/lib/voting";

export const runtime = "nodejs";
export async function POST(request) {
  return handleVote(request);
}
