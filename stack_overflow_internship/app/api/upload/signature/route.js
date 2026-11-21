import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export async function POST() {
  try {
    await getAuth();
    const {
      CLOUDINARY_CLOUD_NAME: cloudName,
      CLOUDINARY_API_KEY: apiKey,
      CLOUDINARY_API_SECRET: apiSecret,
      CLOUDINARY_UPLOAD_PRESET: uploadPreset,
    } = process.env;
    if (
      !cloudName ||
      !apiKey ||
      !apiSecret ||
      [cloudName, apiKey, apiSecret].some((value) => value === "replace_me")
    )
      throw Object.assign(
        new Error(
          "Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        ),
        { status: 503 },
      );
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = [
      `timestamp=${timestamp}`,
      ...(uploadPreset ? [`upload_preset=${uploadPreset}`] : []),
    ];
    const payload = `${signedParams.join("&")}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(payload).digest("hex");
    return NextResponse.json({
      cloudName,
      apiKey,
      ...(uploadPreset ? { uploadPreset } : {}),
      timestamp,
      signature,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
