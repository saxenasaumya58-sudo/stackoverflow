import mongoose from "mongoose";

const { Schema } = mongoose;
const LanguageOtpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", default: null },
    otp: { type: String },
    targetLanguage: { type: String, enum: ["en", "es", "hi", "pt", "zh", "fr"], required: true },
    type: { type: String, enum: ["email", "mobile"], required: true },
    destination: { type: String },
    pendingMobile: { type: String, trim: true, match: /^\d{10}$/ },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);
LanguageOtpSchema.index({ userId: 1, targetLanguage: 1 }, { unique: true });

export const LanguageOtp =
  mongoose.models.LanguageOtp || mongoose.model("LanguageOtp", LanguageOtpSchema);

export default LanguageOtp;