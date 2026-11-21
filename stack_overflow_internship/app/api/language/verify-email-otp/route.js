import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { LanguageOtp, User } from "@/lib/models";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["otp", "targetLanguage"]);
    if (body.targetLanguage !== "fr")
      throw Object.assign(new Error("Choose a supported language."), {
        status: 400,
      });
    const otp = String(body.otp);
    if (!/^\d{6}$/.test(otp))
      throw Object.assign(new Error("Invalid OTP."), { status: 400 });

    await connectDB();
    const { user } = await getAuth();
    const account = await User.collection.findOne(
      { _id: user._id },
      { projection: { mobile: 1, phone: 1, mobileNumber: 1 } },
    );
    const registeredMobile =
      account?.mobile || account?.phone || account?.mobileNumber;
    const now = new Date();
    const challenge = await LanguageOtp.findOne({
      userId: user._id,
      targetLanguage: "fr",
      type: "email",
      expiresAt: { $gt: now },
      attempts: { $lt: 5 },
    });
    if (!challenge)
      throw Object.assign(new Error("Invalid or expired OTP."), {
        status: 400,
      });
    if (challenge.otp !== otp) {
      await LanguageOtp.updateOne(
        { _id: challenge._id, expiresAt: { $gt: now }, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
      );
      throw Object.assign(new Error("Invalid or expired OTP."), {
        status: 400,
      });
    }
    if (!registeredMobile && !challenge.pendingMobile)
      throw Object.assign(
        new Error("A mobile number is required to complete this language change."),
        { status: 400 },
      );

    const consumed = await LanguageOtp.findOneAndDelete({
      _id: challenge._id,
      otp,
      expiresAt: { $gt: now },
      attempts: { $lt: 5 },
    });
    if (!consumed)
      throw Object.assign(new Error("Invalid or expired OTP."), {
        status: 400,
      });

    const values = {
      language: "fr",
      preferredLanguage: "fr",
      mobile: registeredMobile || challenge.pendingMobile,
      phone: registeredMobile || challenge.pendingMobile,
    };
    const result = await User.collection.updateOne(
      { _id: user._id },
      {
        $set: values,
        $unset: { pendingMobile: "" },
      },
    );
    if (result.matchedCount !== 1)
      throw Object.assign(new Error("Your session is invalid or expired."), {
        status: 401,
      });

    const response = NextResponse.json({
      success: true,
      language: "fr",
      mobile: values.mobile,
    });
    response.cookies.set("NEXT_LOCALE", "fr", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set("lang", "fr", {
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
