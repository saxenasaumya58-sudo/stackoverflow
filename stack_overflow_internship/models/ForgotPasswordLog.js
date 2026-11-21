import mongoose from "mongoose";

const { Schema } = mongoose;
const ForgotPasswordLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    ip: { type: String, default: "" },
    forgotPasswordOtp: { type: String, select: false },
    tokenHash: { type: String, select: false },
    passwordCiphertext: { type: String, select: false },
    pendingMobile: { type: String, trim: true, match: /^\d{10}$/ },
    expiresAt: Date,
    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ForgotPasswordLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const ForgotPasswordLog =
  mongoose.models.ForgotPasswordLog ||
  mongoose.model("ForgotPasswordLog", ForgotPasswordLogSchema);