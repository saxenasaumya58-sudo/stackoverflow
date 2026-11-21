import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { PhoneOtp } from "@/lib/models";
import { normalizeIndianMobile } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(request) {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json(
      { error: "Test OTPs are only available in development." },
      { status: 404 },
    );

  try {
    const body = await request.json();
    requireFields(body, ["mobile", "otp"]);
    const mobile = normalizeIndianMobile(body.mobile);
    await connectDB();

    const challenge = await PhoneOtp.findOne({
      mobile,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (!challenge)
      return NextResponse.json(
        { verified: false, error: "Invalid or expired OTP." },
        { status: 400 },
      );

    const otp = String(body.otp);
    const valid =
      /^\d{4}$/.test(otp) && (await bcrypt.compare(otp, challenge.otpHash));
    if (!valid) {
      await PhoneOtp.updateOne(
        {
          _id: challenge._id,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
      );
      return NextResponse.json(
        { verified: false, error: "Invalid or expired OTP." },
        { status: 400 },
      );
    }

    const consumed = await PhoneOtp.deleteOne({
      _id: challenge._id,
      otpHash: challenge.otpHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    });
    if (consumed.deletedCount !== 1)
      return NextResponse.json(
        { verified: false, error: "Invalid or expired OTP." },
        { status: 400 },
      );

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    return errorResponse(error);
  }
}
