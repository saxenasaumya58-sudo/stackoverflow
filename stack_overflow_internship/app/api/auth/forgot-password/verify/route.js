import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import {
  ForgotPasswordAttempt,
  ForgotPasswordLog,
  Session,
  User,
} from "@/lib/models";

export const runtime = "nodejs";
const maxInvalidAttempts = 5;
const lockoutMs = 10 * 60 * 1000;

function requestIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function isBlocked(ip, now) {
  const attempt = await ForgotPasswordAttempt.findOne({
    ip,
    blockedUntil: { $gt: now },
  }).select("_id");
  return Boolean(attempt);
}

async function recordInvalidAttempt(ip, now) {
  const windowExpired = {
    $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now],
  };
  const nextAttempts = {
    $cond: [
      windowExpired,
      1,
      { $add: [{ $ifNull: ["$attempts", 0] }, 1] },
    ],
  };
  const blockedUntil = new Date(now.getTime() + lockoutMs);
  let attempt;
  try {
    attempt = await ForgotPasswordAttempt.findOneAndUpdate(
      { ip },
      [
        {
          $set: {
            attempts: nextAttempts,
            windowStartedAt: {
              $cond: [windowExpired, now, "$windowStartedAt"],
            },
            blockedUntil: {
              $cond: [
                { $gte: [nextAttempts, maxInvalidAttempts] },
                blockedUntil,
                null,
              ],
            },
            expiresAt: {
              $cond: [
                { $gte: [nextAttempts, maxInvalidAttempts] },
                blockedUntil,
                new Date(now.getTime() + lockoutMs),
              ],
            },
          },
        },
      ],
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    attempt = await ForgotPasswordAttempt.findOneAndUpdate(
      { ip },
      [
        {
          $set: {
            attempts: nextAttempts,
            windowStartedAt: {
              $cond: [windowExpired, now, "$windowStartedAt"],
            },
            blockedUntil: {
              $cond: [
                { $gte: [nextAttempts, maxInvalidAttempts] },
                blockedUntil,
                null,
              ],
            },
            expiresAt: {
              $cond: [
                { $gte: [nextAttempts, maxInvalidAttempts] },
                blockedUntil,
                new Date(now.getTime() + lockoutMs),
              ],
            },
          },
        },
      ],
      { new: true },
    );
  }
  return (attempt?.attempts || 0) >= maxInvalidAttempts;
}

function invalidTokenResponse(blocked = false) {
  return NextResponse.json(
    {
      error: blocked
        ? "Too many invalid reset tokens. Try again in 10 minutes."
        : "The reset token is invalid or expired.",
    },
    { status: blocked ? 429 : 400 },
  );
}

function decryptPassword(value) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Password reset encryption is not configured.");
  const [ivHex, tagHex, ciphertextHex] = value.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    crypto.createHash("sha256").update(secret).digest(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["identifier", "token"]);
    const identifier = String(body.identifier).trim();
    await connectDB();
    const ip = requestIp(request);
    const now = new Date();
    if (await isBlocked(ip, now))
      return invalidTokenResponse(true);
    const user = await User.findOne(
      identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
    ).select("+mobile");
    if (!user)
      return invalidTokenResponse(await recordInvalidAttempt(ip, now));

    const tokenHash = crypto.createHash("sha256").update(String(body.token)).digest("hex");
    const candidate = await ForgotPasswordLog.findOne({
      userId: user._id,
      $or: [{ forgotPasswordOtp: tokenHash }, { tokenHash }],
      isUsed: false,
      expiresAt: { $gt: now },
    }).select("+forgotPasswordOtp +tokenHash +passwordCiphertext");
    if (!candidate)
      return invalidTokenResponse(await recordInvalidAttempt(ip, now));
    if (!user.mobile && !candidate.pendingMobile)
      throw Object.assign(
        new Error("A mobile number is required to complete this password reset."),
        { status: 400 },
      );

    const challenge = await ForgotPasswordLog.findOneAndUpdate(
      { _id: candidate._id, isUsed: false, expiresAt: { $gt: now } },
      { $set: { isUsed: true } },
      { new: true },
    ).select("+forgotPasswordOtp +tokenHash +passwordCiphertext");
    if (!challenge)
      return invalidTokenResponse(await recordInvalidAttempt(ip, now));

    const temporaryPassword = decryptPassword(challenge.passwordCiphertext || "");
    if (!/^[A-Za-z]+$/.test(temporaryPassword))
      throw new Error("The temporary password is invalid.");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    if (!user.mobile) {
      user.mobile = candidate.pendingMobile;
      user.phone = candidate.pendingMobile;
    } else if (!user.phone) {
      user.phone = user.mobile;
    }
    user.password = passwordHash;
    user.passwordHash = passwordHash;
    user.lastPasswordReset = now;
    await user.save();
    await Session.updateMany(
      { user: user._id, isActive: { $ne: false }, revokedAt: null },
      {
        $set: {
          revokedAt: now,
          isActive: false,
          isRevoked: true,
        },
      },
    );
    await ForgotPasswordLog.updateOne(
      { _id: challenge._id },
      {
        $unset: {
          passwordCiphertext: 1,
          forgotPasswordOtp: 1,
          tokenHash: 1,
        },
      },
    );
    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    return errorResponse(error);
  }
}