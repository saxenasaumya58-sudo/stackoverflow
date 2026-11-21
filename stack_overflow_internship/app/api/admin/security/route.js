import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { LoginLog } from "@/lib/models";
import { SESSION_CONFIG } from "@/lib/session-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const { user } = await getAuth();
    if (user.role !== "admin")
      throw Object.assign(new Error("Admin access is required."), {
        status: 403,
      });
    await connectDB();
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 25)));
    const [logs, total] = await Promise.all([
      LoginLog.find()
      .sort({ loginAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-deviceId")
      .populate("user", "name email")
      .lean(),
      LoginLog.countDocuments(),
    ]);
    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      inactivityWindowMinutes: SESSION_CONFIG.INACTIVITY_WINDOW_MINUTES,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
