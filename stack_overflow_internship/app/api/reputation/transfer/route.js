import { transferReputation } from "@/lib/reputation-transfer";

export const runtime = "nodejs";
export async function POST(request) {
  return transferReputation(request);
}
