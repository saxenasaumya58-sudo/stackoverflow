import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { LanguageOtp, User } from "@/lib/models";
import { normalizeIndianMobile, sendEmail } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    requireFields(body, ["targetLanguage"]);
    if (body.targetLanguage !== "fr")
      throw Object.assign(new Error("Choose a supported language."), {
        status: 400,
      });

    await connectDB();
    const { user } = await getAuth();
    const account = await User.collection.findOne(
      { _id: user._id },
      { projection: { mobile: 1, phone: 1, mobileNumber: 1 } },
    );
    const registeredMobile =
      account?.mobile || account?.phone || account?.mobileNumber;
    const mobile = registeredMobile
      ? undefined
      : body.mobile
        ? normalizeIndianMobile(body.mobile)
        : "";
    if (!registeredMobile && !mobile)
      return NextResponse.json({
        success: true,
        requiresMobile: true,
        message:
          "Your mobile number is not registered on your account. Please enter your mobile number once.",
      });

    const otp = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const challenge = await LanguageOtp.findOneAndUpdate(
      { userId: user._id, targetLanguage: "fr" },
      {
        $set: {
          type: "email",
          destination: user.email,
          otp,
          expiresAt,
          attempts: 0,
          ...(mobile ? { pendingMobile: mobile } : {}),
        },
        ...(mobile ? {} : { $unset: { pendingMobile: 1 } }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    let deliveryFailed = false;
    try {
      const delivery = await sendEmail({
        to: user.email,
        subject: "Your Commons language change code",
        text: `Your verification code is ${otp}. It expires in 5 minutes.`,
        requireRealDelivery: true,
      });
      const accepted = Array.isArray(delivery?.accepted)
        ? delivery.accepted.some((recipient) => {
            const address =
              typeof recipient === "string" ? recipient : recipient?.address;
            return String(address || "").toLowerCase() === user.email.toLowerCase();
          })
        : false;
      if (!accepted) {
        deliveryFailed = true;
        console.error(
          `French language OTP email was not accepted by SMTP for ${user.email}; using the in-app fallback.`,
        );
      }
    } catch (deliveryError) {
      deliveryFailed = true;
      console.error(
        `French language OTP email delivery failed for ${user.email}; using the in-app fallback.`,
        deliveryError,
      );
    }

    if (deliveryFailed) {
      console.log(`OTP for ${user.email} is ${otp}`);
      return NextResponse.json({
        success: true,
        expiresAt,
        deliveryFailed: true,
        demoOtp: otp,
      });
    }

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
