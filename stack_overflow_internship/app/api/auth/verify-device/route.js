import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import {
  matchesDeviceSecret,
  recordLogin,
} from "@/lib/login-security";
import { Session, User } from "@/lib/models";
import { sendEmail } from "@/lib/services";
import { sessionExpiry, signSession } from "@/lib/auth";
import {
  DEVICE_SECURITY_CONFIG,
  getTrustedDeviceExpiry,
} from "@/lib/session-config";
import { isDeviceOtpChallengeUsable } from "@/lib/device-security.mjs";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["challengeId", "otp"]);
    await connectDB();
    const now = new Date();
    const session = await Session.findOne({
      _id: body.challengeId,
      purpose: "device-login",
      isActive: true,
      revokedAt: null,
      loginVerificationAttempts: {
        $lt: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
      },
      otpExpiresAt: { $gt: now },
      expiresAt: { $gt: now },
    }).select("+loginVerificationOtp +otpHash");
    if (
      !isDeviceOtpChallengeUsable(session, {
        now,
        maxAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
      })
    )
      throw Object.assign(
        new Error("The verification code is invalid or expired."),
        { status: 400 },
      );
    if (!matchesDeviceSecret(request, session.deviceId))
      throw Object.assign(
        new Error("The verification request is not from the same device."),
        { status: 401 },
      );
    if (!/^\d{6}$/.test(String(body.otp)))
      throw Object.assign(
        new Error("The verification code is invalid or expired."),
        { status: 400 },
      );
    const otpMatches = await bcrypt.compare(
      String(body.otp),
      session.loginVerificationOtp || session.otpHash || "",
    );
    if (!otpMatches) {
      const failedAttempt = await Session.findOneAndUpdate(
        {
          _id: session._id,
          purpose: "device-login",
          isActive: true,
          revokedAt: null,
          loginVerificationAttempts: {
            $lt: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
          },
        },
        { $inc: { loginVerificationAttempts: 1 } },
        { new: true },
      );
      if (
        failedAttempt?.loginVerificationAttempts >=
        DEVICE_SECURITY_CONFIG.otpMaxAttempts
      )
        await Session.deleteOne({ _id: session._id });
      throw Object.assign(
        new Error("The verification code is invalid or expired."),
        { status: 400 },
      );
    }
    const user = await User.findById(session.user);
    if (!user || user.suspendedAt || user.isSuspended)
      throw Object.assign(new Error("This account is unavailable."), {
        status: 403,
      });
    const loginAt = new Date();
    await sendEmail({
      to: user.email,
      subject: "New Device Login Detected",
      text: [
        "A new device login was detected on your Commons account.",
        `Browser: ${session.browser || "Unknown"}`,
        `Operating system: ${session.operatingSystem || "Unknown"}`,
        `Device: ${session.deviceType || "Unknown"}`,
        `IP address: ${session.ipAddress || "Unknown"}`,
        `Location: ${session.location || "Unknown"}`,
        `Time (UTC): ${loginAt.toISOString()}`,
      ].join("\n"),
      requireRealDelivery: true,
    });
    session.purpose = undefined;
    session.loginVerificationOtp = undefined;
    session.otpHash = undefined;
    session.otpExpiresAt = undefined;
    session.tokenId = crypto.randomUUID();
    session.expiresAt = sessionExpiry();
    session.loginAt = loginAt;
    session.lastActiveAt = loginAt;
    session.lastActivityAt = session.lastActiveAt;
    session.trusted = !!session.trustDeviceOnVerify;
    session.isTrusted = session.trusted;
    user.trustedDevices = user.trustedDevices.filter(
      (device) =>
        String(device.deviceId) !== String(session.deviceId) &&
        new Date(device.expiresAt).getTime() > loginAt.getTime(),
    );
    if (session.trusted) {
      user.trustedDevices.push({
        deviceId: session.deviceId,
        label: session.deviceLabel,
        lastSeenAt: loginAt,
        expiresAt: getTrustedDeviceExpiry(loginAt),
      });
    }
    await user.save();
    await session.save();
    await recordLogin(user._id, session);
    signSession(session);
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        reputation: user.reputation,
        language: user.language,
        mobile: user.mobile,
        phone: user.phone,
        bio: user.bio,
        location: user.location,
        website: user.website,
        avatarUrl: user.avatarUrl,
      },
      session: {
        id: String(session._id),
        deviceLabel: session.deviceLabel,
        browser: session.browser,
        operatingSystem: session.operatingSystem,
        deviceType: session.deviceType,
        ipAddress: session.ipAddress,
        location: session.location || null,
        loginAt: session.loginAt,
        expiresAt: session.expiresAt,
        trusted: session.trusted,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
