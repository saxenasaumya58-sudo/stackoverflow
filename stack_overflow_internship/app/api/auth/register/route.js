import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import {
  getLoginDetails,
  getOrCreateDeviceSecret,
  hashDeviceSecret,
  setDeviceCookie,
} from "@/lib/login-security";
import { Plan, Session, Subscription, User } from "@/lib/models";
import { plans } from "@/lib/plans";
import { DEVICE_SECURITY_CONFIG } from "@/lib/session-config";
import { sendEmail } from "@/lib/services";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["name", "email", "password", "mobile"]);
    const mobile = String(body.mobile).trim();
    if (!/^[6-9]\d{9}$/.test(mobile))
      throw Object.assign(new Error("Enter a valid 10-digit mobile number."), {
        status: 400,
      });
    if (body.password.length < 8 || body.password.length > 128)
      throw Object.assign(
        new Error("Password must be between 8 and 128 characters."),
        { status: 400 },
      );
    await connectDB();
    const passwordHash = await bcrypt.hash(body.password, 12);
    let user;
    try {
      user = await User.create({
        name: body.name.trim(),
        email: body.email.toLowerCase().trim(),
        mobile,
        phone: mobile,
        passwordHash,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      return NextResponse.json(
        { error: "An account using this email address or phone number already exists. Sign in or reset your password." },
        { status: 409 },
      );
    }
    await Plan.findOneAndUpdate(
      { slug: "free" },
      {
        $setOnInsert: (({ questionLimit, ...plan }) => plan)(plans[0]),
        $set: { questionLimit: plans[0].questionLimit },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await Subscription.create({
      userId: user._id,
      user: user._id,
      plan: "free",
      status: "active",
      startedAt: new Date(),
      startDate: new Date(),
      billingDetails: { name: user.name, email: user.email, address: "" },
    });
    const deviceSecret = getOrCreateDeviceSecret(request);
    const otp = String(crypto.randomInt(100000, 1000000));
    const challengeCreatedAt = new Date();
    const session = await Session.create({
      user: user._id,
      deviceId: hashDeviceSecret(deviceSecret),
      ...getLoginDetails(request),
      purpose: "device-login",
      trusted: false,
      isTrusted: false,
      trustDeviceOnVerify: true,
      loginVerificationOtp: await bcrypt.hash(otp, 10),
      otpExpiresAt: new Date(
        challengeCreatedAt.getTime() + DEVICE_SECURITY_CONFIG.otpLifetimeMs,
      ),
      expiresAt: new Date(
        challengeCreatedAt.getTime() +
          DEVICE_SECURITY_CONFIG.challengeLifetimeMs,
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
    const response = NextResponse.json(
      {
        requiresOtp: true,
        challengeId: String(session._id),
        destination: user.email.replace(/(^.).*(@.*$)/, "$1••••$2"),
      },
      { status: 201 },
    );
    return setDeviceCookie(response, deviceSecret);
  } catch (error) {
    return errorResponse(error);
  }
}
