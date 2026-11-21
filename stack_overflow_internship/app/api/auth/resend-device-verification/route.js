import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { matchesDeviceSecret } from "@/lib/login-security";
import { Session, User } from "@/lib/models";
import { sendEmail } from "@/lib/services";
import { DEVICE_SECURITY_CONFIG } from "@/lib/session-config";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["challengeId"]);
    await connectDB();
    const session = await Session.findOne({
      _id: body.challengeId,
      purpose: "device-login",
      isActive: true,
      revokedAt: null,
      loginVerificationAttempts: {
        $lt: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
      },
      expiresAt: { $gt: new Date() },
    }).select("+loginVerificationOtp +otpHash");
    if (!session)
      throw Object.assign(
        new Error("The login verification request has expired."),
        { status: 400 },
      );
    if (!matchesDeviceSecret(request, session.deviceId))
      throw Object.assign(
        new Error("The verification request is not from the same device."),
        { status: 401 },
      );
    const user = await User.findById(session.user);
    if (!user || user.suspendedAt || user.isSuspended)
      throw Object.assign(new Error("This account is unavailable."), {
        status: 403,
      });

    const otp = String(crypto.randomInt(100000, 1000000));
    session.loginVerificationOtp = await bcrypt.hash(otp, 10);
    session.otpHash = undefined;
    const now = new Date();
    session.otpExpiresAt = new Date(
      now.getTime() + DEVICE_SECURITY_CONFIG.otpLifetimeMs,
    );
    await session.save();
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

    return NextResponse.json({
      success: true,
      destination: user.email.replace(/(^.).*(@.*$)/, "$1••••$2"),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
