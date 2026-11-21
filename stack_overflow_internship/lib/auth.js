import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { Session, User } from "@/lib/models";
import { verifySession } from "@/lib/sessionGuard";
import { checkPrivilege } from "@/lib/reputation";
import { SESSION_CONFIG } from "@/lib/session-config";

const cookieName = "commons_session";
function secret() { if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters."); return process.env.JWT_SECRET; }
export function sessionLifetimeSeconds() { return Math.max(1, Math.floor(SESSION_CONFIG.inactivityMs / 1000)); }
export function sessionExpiry() { return new Date(Date.now() + sessionLifetimeSeconds() * 1000); }

export function signSession(session) {
  const lifetime = sessionLifetimeSeconds();
  const token = jwt.sign({ sub: String(session.user), sid: String(session._id), jti: session.tokenId }, secret(), { expiresIn: lifetime, issuer: "commons" });
  cookies().set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: lifetime });
}

export async function getAuth({ required = true, refresh = true } = {}) {
  try {
    const { payload, session } = await verifySession();
    if (refresh) signSession(session);
    const user = await User.findById(payload.sub).select("+mobile");
    if (!user || user.suspendedAt || user.isSuspended) throw Object.assign(new Error("This account is unavailable."), { status: 403 });
    return { user, session };
  } catch (error) {
    if (!required) return null;
    throw error;
  }
}

export async function clearSession() {
  const token = cookies().get(cookieName)?.value;
  if (token) {
    let payload;
    try {
      payload = jwt.verify(token, secret(), { issuer: "commons" });
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) throw error;
    }
    if (payload) {
      await connectDB();
      await Session.deleteOne({ _id: payload.sid, user: payload.sub });
    }
  }
  cookies().set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function requireReputation(minimum) {
  const { user } = await getAuth();
  if (user.role !== "admin" && !checkPrivilege(user.reputation, minimum)) throw Object.assign(new Error(`This action requires ${minimum} reputation points.`), { status: 403 });
  return user;
}