import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { ForgotPasswordLog, User } from "@/lib/models";
import { normalizeIndianMobile, sendSms } from "@/lib/services";

export const runtime = "nodejs";
const dailyMessage = "You can use this option only one time per day.";
function generateAlphaPassword(len = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from(
    { length: len },
    () => chars[crypto.randomInt(chars.length)],
  ).join("");
}

function encryptPassword(password) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw Object.assign(new Error("Password reset encryption is not configured."), { status: 503 });
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString("hex")).join(".");
}

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["identifier"]);
    const identifier = body.identifier.trim();
    await connectDB();
    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail ? { email: identifier.toLowerCase() } : { phone: identifier },
    ).select("+mobile");
    if (!user)
      return NextResponse.json({
        success: true,
        message:
          "If the account is registered, a temporary password will be sent to its verified contact.",
      });
    const mobile = user.mobile
      ? normalizeIndianMobile(user.mobile)
      : body.mobile
        ? normalizeIndianMobile(body.mobile)
        : "";
    if (!mobile)
      return NextResponse.json({
        success: true,
        requiresMobile: true,
        message:
          "Your mobile number is not registered on your account. Please enter your mobile number once.",
      });
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentRequest = await ForgotPasswordLog.findOne({
      userId: user._id,
      createdAt: { $gte: cutoff },
    }).select("_id");
    if (recentRequest)
      return NextResponse.json({ error: dailyMessage }, { status: 429 });
    const claimedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { lastForgotPasswordRequestAt: { $lte: cutoff } },
          { lastForgotPasswordRequestAt: { $exists: false } },
          { lastForgotPasswordRequestAt: null },
        ],
      },
      { $set: { lastForgotPasswordRequestAt: now } },
      { new: true },
    );
    if (!claimedUser)
      return NextResponse.json({ error: dailyMessage }, { status: 429 });
    const temporaryPassword = generateAlphaPassword();
    if (!/^[A-Za-z]+$/.test(temporaryPassword))
      throw new Error("Temporary password generation failed.");
    const token = crypto.randomBytes(32).toString("hex");
    let challenge;
    try {
      challenge = await ForgotPasswordLog.create({
      userId: user._id,
      date: now.toISOString().slice(0, 10),
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      forgotPasswordOtp: crypto.createHash("sha256").update(token).digest("hex"),
      passwordCiphertext: encryptPassword(temporaryPassword),
      ...(!user.mobile ? { pendingMobile: mobile } : {}),
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      isUsed: false,
      });
    } catch (error) {
      await User.updateOne(
        { _id: user._id, lastForgotPasswordRequestAt: now },
        { $unset: { lastForgotPasswordRequestAt: 1 } },
      );
      throw error;
    }
    let developmentCredentials;
    try {
      const text = `Your temporary password is ${temporaryPassword}. Verify it with this one-time reset token within 15 minutes: ${token}`;
      if (process.env.NODE_ENV !== "production") {
        developmentCredentials = {
          temporaryPassword,
          token,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        };
        console.info("[forgot-password] development reset credentials", {
          userId: String(user._id),
          temporaryPassword,
          token,
          expiresAt: developmentCredentials.expiresAt,
        });
      } else {
        await sendSms({
          to: `+91${mobile}`,
          body: text,
          requireRealDelivery: true,
        });
      }
    } catch (deliveryError) {
      await ForgotPasswordLog.deleteOne({ _id: challenge._id });
      await User.updateOne(
        { _id: user._id, lastForgotPasswordRequestAt: now },
        { $unset: { lastForgotPasswordRequestAt: 1 } },
      );
      console.error("[forgot-password] delivery failed", { message: deliveryError.message });
      return NextResponse.json(
        { error: "Failed to send reset details, try again" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      message: "Reset details sent. Verify the token within 15 minutes to apply the new password.",
      ...(developmentCredentials ? { developmentCredentials } : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
