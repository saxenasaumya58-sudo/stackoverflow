import bcrypt from "bcryptjs";
import crypto from "node:crypto";
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
    requireFields(body, ["mobile"]);
    const mobile = normalizeIndianMobile(body.mobile);
    const otp = String(crypto.randomInt(1000, 10000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await connectDB();
    await PhoneOtp.findOneAndUpdate(
      { mobile },
      {
        $set: {
          otpHash: await bcrypt.hash(otp, 10),
          expiresAt,
          attempts: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({ success: true, mobile, otp, expiresAt });
  } catch (error) {
    return errorResponse(error);
  }
}
