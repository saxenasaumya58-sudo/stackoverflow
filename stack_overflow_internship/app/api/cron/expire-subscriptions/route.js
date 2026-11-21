import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Subscription } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  await connectDB();
  const result = await Subscription.updateMany(
    {
      status: "active",
      plan: { $ne: "free" },
      $or: [
        { renewalDate: { $lte: new Date() } },
        { renewalDate: { $exists: false } },
        { renewalDate: null },
      ],
    },
    { $set: { status: "expired", active: false } },
  );
  return NextResponse.json({ expired: result.modifiedCount });
}