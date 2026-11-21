import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { sessionExpiry, signSession } from "@/lib/auth";
import { errorResponse, requireFields } from "@/lib/http";
import {
  getLoginDetails,
  getOrCreateDeviceSecret,
  hashDeviceSecret,
  isTrustedDevice,
  recordLogin,
  setDeviceCookie,
} from "@/lib/login-security";
import { Session, User } from "@/lib/models";
import {
  DEVICE_SECURITY_CONFIG,
  getTrustedDeviceExpiry,
} from "@/lib/session-config";
import { sendEmail } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["email", "password"]);
    await connectDB();
    const user = await User.findOne({
      email: body.email.toLowerCase().trim(),
    }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash)))
      throw Object.assign(new Error("Email or password is incorrect."), {
        status: 401,
      });
    if (user.suspendedAt || user.isSuspended)
      throw Object.assign(new Error("This account has been suspended."), {
        status: 403,
      });
    const deviceSecret = getOrCreateDeviceSecret(request);
    const deviceId = hashDeviceSecret(deviceSecret);
      const loginAt = new Date();
      const known = isTrustedDevice(user.trustedDevices, deviceId, loginAt);
    const details = getLoginDetails(request);
      if (known) {
        const trustedDevice = user.trustedDevices.find(
          (device) => device.deviceId === deviceId,
        );
        trustedDevice.lastSeenAt = loginAt;
        trustedDevice.expiresAt = getTrustedDeviceExpiry(loginAt);
        await user.save();
      }
    const info = {
      userId: user._id,
      deviceId,
      loginAt,
      lastActiveAt: loginAt,
      lastActivityAt: loginAt,
      ...details,
    };
    if (!known) {
      const otp = String(crypto.randomInt(100000, 1000000));
      const session = await Session.create({
        user: user._id,
        ...info,
        purpose: "device-login",
        trusted: false,
        isTrusted: false,
        trustDeviceOnVerify: body.trusted === true,
        loginVerificationOtp: await bcrypt.hash(otp, 10),
        otpExpiresAt: new Date(
          loginAt.getTime() + DEVICE_SECURITY_CONFIG.otpLifetimeMs,
        ),
        expiresAt: new Date(
          loginAt.getTime() + DEVICE_SECURITY_CONFIG.challengeLifetimeMs,
        ),
      });
      try {
        await sendEmail({
          to: user.email,
          subject: "Verify your new device",
          text: `Your Commons verification code is ${otp}. It expires in ${Math.ceil(DEVICE_SECURITY_CONFIG.otpLifetimeMs / 60000)} minutes.`,
          requireRealDelivery: true,
        });
      } catch (deliveryError) {
        await Session.deleteOne({ _id: session._id });
        throw Object.assign(
          new Error("Email verification could not be sent."),
          { status: 503, cause: deliveryError },
        );
      }
      const response = NextResponse.json({
        requiresOtp: true,
        challengeId: String(session._id),
        destination: user.email.replace(/(^.).*(@.*$)/, "$1••••$2"),
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
      });
      return setDeviceCookie(response, deviceSecret);
    }
    const tokenId = crypto.randomUUID();
    const session = await Session.create({
      user: user._id,
      ...info,
      trusted: true,
      isTrusted: true,
      tokenId,
      expiresAt: sessionExpiry(),
    });
    await Session.updateMany(
      {
        user: user._id,
        _id: { $ne: session._id },
        revokedAt: null,
        expiresAt: { $lt: loginAt },
      },
      { $set: { revokedAt: loginAt, isActive: false } },
    );
    await recordLogin(user._id, session);
    signSession(session);
    const response = NextResponse.json({
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
    return setDeviceCookie(response, deviceSecret);
  } catch (error) {
    return errorResponse(error);
  }
}
