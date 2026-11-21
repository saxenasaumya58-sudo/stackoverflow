import mongoose from "mongoose";

const { Schema } = mongoose;
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, sparse: true },
    mobileNumber: { type: String, trim: true, sparse: true },
    mobile: { type: String, required: true, trim: true, match: /^\d{10}$/, select: false },
    pendingMobile: { type: String, trim: true, match: /^\d{10}$/, select: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    otpAttempts: { type: Number, min: 0, select: false },
    password: { type: String, select: false },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["member", "admin"], default: "member" },
    reputation: { type: Number, default: 0, min: 0 },
    reputationAwardEvents: [{ reference: String }],
    reputationTransferEvents: [{ transferId: Schema.Types.ObjectId, points: Number, createdAt: Date, refunded: Boolean }],
    reputationReceivedEvents: [{ transferId: Schema.Types.ObjectId, points: Number, createdAt: Date }],
    language: { type: String, enum: ["en", "es", "hi", "pt", "zh", "fr"], default: "en" },
    preferredLanguage: { type: String, enum: ["en", "es", "hi", "pt", "zh", "fr"] },
    bio: { type: String, maxlength: 500, default: "" },
    location: { type: String, default: "" },
    website: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    suspendedAt: Date,
    isSuspended: { type: Boolean, default: false },
    profileBonusAwardedAt: Date,
    lastPasswordReset: Date,
    lastForgotPasswordRequestAt: Date,
    trustedDevices: [
      { deviceId: String, label: String, lastSeenAt: Date, expiresAt: Date },
    ],
  },
  { timestamps: true },
);
UserSchema.pre("validate", function syncLanguageAliases() {
  if (!this.isModified("preferredLanguage"))
    this.preferredLanguage = this.language || "en";
  else
    this.language = this.preferredLanguage || this.language || "en";
});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
