import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Session } from "@/lib/models";
import { SESSION_CONFIG } from "@/lib/session-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user, session: currentSession } = await getAuth();
    await connectDB();
    const now = new Date();
    const sessions = await Session.find({
      user: user._id,
      purpose: null,
      isActive: { $ne: false },
      isRevoked: { $ne: true },
      revokedAt: null,
      expiresAt: { $gt: now },
      lastActiveAt: { $gt: new Date(now.getTime() - SESSION_CONFIG.inactivityMs) },
    })
      .select(
        "deviceLabel deviceType browser operatingSystem ipAddress location trusted loginAt lastActiveAt expiresAt",
      )
      .sort({ lastActiveAt: -1 })
      .lean();
    return NextResponse.json({
      sessions,
      currentSessionId: String(currentSession._id),
      inactivityWindowMinutes: SESSION_CONFIG.INACTIVITY_WINDOW_MINUTES,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
