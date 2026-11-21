import { NextResponse } from "next/server";
import {
  cleanupReputationTransferMarkers,
  reconcilePendingReputationTransfers,
} from "@/lib/reputation-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await reconcilePendingReputationTransfers({ limit: 100 });
  await cleanupReputationTransferMarkers();
  return NextResponse.json(result);
}