import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { getDeviceSecret } from "@/lib/login-security";
import { isSessionUsable } from "@/lib/device-security.mjs";
import { Session } from "@/lib/models";
import { SESSION_CONFIG } from "@/lib/session-config";

const cookieName = "commons_session";
export const INACTIVITY_TIMEOUT = SESSION_CONFIG.inactivityMs;

function sessionLifetimeSeconds() {
  return Math.max(1, Math.floor(SESSION_CONFIG.inactivityMs / 1000));
}

export async function verifySession(request) {
  const cookieStore = request?.cookies || cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token)
    throw Object.assign(new Error("Sign in is required."), { status: 401 });
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw Object.assign(new Error("Your session is invalid or expired."), { status: 401 });

  let payload;
  try {
    payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "commons",
    });
  } catch {
    throw Object.assign(new Error("Your session is invalid or expired."), {
      status: 401,
    });
  }

  await connectDB();
  const now = new Date();
  const inactiveSince = new Date(now.getTime() - SESSION_CONFIG.inactivityMs);
  const session = await Session.findOne({
    _id: payload.sid,
    tokenId: payload.jti,
    user: payload.sub,
    purpose: null,
    isActive: { $ne: false },
    isRevoked: { $ne: true },
    revokedAt: null,
    expiresAt: { $gt: now },
    lastActiveAt: { $gt: inactiveSince },
  });
  if (
    !isSessionUsable(session, {
      now,
      inactivityWindowMs: SESSION_CONFIG.inactivityMs,
      deviceSecret: getDeviceSecret({ cookies: cookieStore }),
    })
  )
    throw Object.assign(new Error("Your session is invalid or expired."), {
      status: 401,
    });

  session.lastActiveAt = now;
  session.lastActivityAt = now;
  session.expiresAt = new Date(
    now.getTime() + sessionLifetimeSeconds() * 1000,
  );
  await session.save();
  return { payload, session };
}