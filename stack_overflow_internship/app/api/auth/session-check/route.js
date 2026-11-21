import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session } = await getAuth();
    return NextResponse.json({ valid: true, lastActiveAt: session.lastActiveAt });
  } catch (error) {
    return errorResponse(error);
  }
}