import mongoose from "mongoose";

const { Schema } = mongoose;
const PhoneOtpSchema = new Schema(
  {
    mobile: { type: String, required: true, unique: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);
PhoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PhoneOtp =
  mongoose.models.PhoneOtp || mongoose.model("PhoneOtp", PhoneOtpSchema);
