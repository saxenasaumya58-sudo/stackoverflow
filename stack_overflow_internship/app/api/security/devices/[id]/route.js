import { NextResponse } from "next/server";
import { clearSession, getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Session } from "@/lib/models";
export const runtime = "nodejs";
export async function DELETE(request, { params }) {
  try {
    const { user, session: currentSession } = await getAuth();
    await connectDB();
    const result = await Session.deleteOne({
      _id: params.id,
      user: user._id,
      purpose: null,
      isActive: { $ne: false },
      isRevoked: { $ne: true },
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (result.deletedCount !== 1)
      throw Object.assign(new Error("Session not found or already revoked."), {
        status: 404,
      });
    if (String(currentSession._id) === String(params.id)) await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
