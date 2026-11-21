import mongoose from "mongoose";

const { Schema } = mongoose;
const ForgotPasswordAttemptSchema = new Schema({
  ip: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  windowStartedAt: { type: Date, required: true },
  blockedUntil: Date,
  expiresAt: { type: Date, required: true },
});
ForgotPasswordAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ForgotPasswordAttempt =
  mongoose.models.ForgotPasswordAttempt ||
  mongoose.model("ForgotPasswordAttempt", ForgotPasswordAttemptSchema);