import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { User } from "@/lib/models";
import { languages } from "@/lib/plans";
import { normalizeIndianMobile } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["mobile", "otp", "targetLanguage"]);
    const mobile = normalizeIndianMobile(body.mobile);
    const otp = String(body.otp);
    if (!/^\d{6}$/.test(otp))
      throw Object.assign(new Error("Galat OTP"), { status: 400 });
    if (!languages.some((language) => language.code === body.targetLanguage))
      throw Object.assign(new Error("Choose a supported language."), {
        status: 400,
      });
    if (body.targetLanguage === "fr")
      throw Object.assign(new Error("French language changes use email OTP."), {
        status: 400,
      });

    await connectDB();
    const { user } = await getAuth();
    const account = await User.collection.findOne(
      { _id: user._id },
      { projection: { mobile: 1, pendingMobile: 1 } },
    );
    const hasMobile = Boolean(account?.mobile);
    const expectedMobile = hasMobile
      ? normalizeIndianMobile(account.mobile)
      : account?.pendingMobile;
    if (!expectedMobile || mobile !== expectedMobile)
      throw Object.assign(new Error("Enter your registered mobile number."), {
        status: 400,
      });

    const now = new Date();
    const result = await User.collection.updateOne(
      {
        _id: user._id,
        [hasMobile ? "mobile" : "pendingMobile"]: hasMobile
          ? account.mobile
          : expectedMobile,
        otp,
        otpExpiry: { $gt: now },
        otpAttempts: { $lt: 5 },
      },
      {
        $set: {
          phone: mobile,
          ...(!hasMobile ? { mobile } : {}),
          language: body.targetLanguage,
          preferredLanguage: body.targetLanguage,
          otp: null,
          otpExpiry: null,
          otpAttempts: 0,
        },
        $unset: { pendingMobile: "" },
      },
    );

    if (result.modifiedCount !== 1) {
      await User.collection.updateOne(
        {
          _id: user._id,
          [hasMobile ? "mobile" : "pendingMobile"]: hasMobile
            ? account.mobile
            : expectedMobile,
          otpExpiry: { $gt: now },
          otpAttempts: { $lt: 5 },
        },
        { $inc: { otpAttempts: 1 } },
      );
      throw Object.assign(new Error("Galat OTP"), { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      language: body.targetLanguage,
    });
    response.cookies.set("NEXT_LOCALE", body.targetLanguage, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set("lang", body.targetLanguage, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
