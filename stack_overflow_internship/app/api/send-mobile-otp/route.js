import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { User } from "@/lib/models";
import { languages } from "@/lib/plans";
import { normalizeIndianMobile, sendSms } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["targetLanguage"]);
    if (
      !languages.some(
        (language) =>
          language.code === body.targetLanguage && language.code !== "fr",
      )
    )
      throw Object.assign(new Error("Choose a supported language."), {
        status: 400,
      });

    await connectDB();
    const { user } = await getAuth();
    const account = await User.findById(user._id).select("+mobile +pendingMobile");
    if (!account)
      throw Object.assign(new Error("Your session is invalid or expired."), {
        status: 401,
      });
    const hasMobile = Boolean(account?.mobile);
    const mobile = hasMobile
      ? normalizeIndianMobile(account.mobile)
      : normalizeIndianMobile(body.mobile);
    const filter = hasMobile
      ? { _id: user._id, mobile: account.mobile }
      : {
          _id: user._id,
          $or: [
            { mobile: null },
            { mobile: { $exists: false } },
            { mobile: "" },
          ],
        };
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const otp = String(crypto.randomInt(100000, 1000000));
    const result = await User.collection.updateOne(filter, {
      $set: {
        ...(hasMobile ? {} : { pendingMobile: mobile }),
        otp,
        otpExpiry: expiresAt,
        otpAttempts: 0,
      },
    });
    if (result.matchedCount !== 1)
      throw Object.assign(new Error("Your session is invalid or expired."), {
        status: 401,
      });

    if (process.env.NODE_ENV === "production") {
      await sendSms({
        to: `+91${mobile}`,
        body: `Your language change verification code is ${otp}. It expires in 5 minutes.`,
        requireRealDelivery: true,
      });
    }

    return NextResponse.json({
      success: true,
      ...(process.env.NODE_ENV === "production" ? {} : { otp }),
      expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
