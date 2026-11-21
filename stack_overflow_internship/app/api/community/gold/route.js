import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { requireGoldOrSilver } from "@/lib/subscriptions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    await requireGoldOrSilver(user._id);
    return NextResponse.json({ community: "gold", posts: [] });
  } catch (error) {
    return errorResponse(error);
  }
}