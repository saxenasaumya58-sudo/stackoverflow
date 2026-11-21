import mongoose from "mongoose";
import { SESSION_CONFIG } from "@/lib/session-config";

const { Schema } = mongoose;
const SessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, required: true },
    deviceLabel: String,
    tokenId: { type: String, unique: true, sparse: true },
    trusted: { type: Boolean, default: false },
    isTrusted: Boolean,
    isActive: { type: Boolean, default: true, index: true },
    isRevoked: { type: Boolean, default: false, index: true },
    trustDeviceOnVerify: Boolean,
    loginVerificationOtp: { type: String, select: false },
    loginVerificationAttempts: { type: Number, default: 0 },
    otpHash: { type: String, select: false },
    otpExpiresAt: Date,
    purpose: String,
    pendingLanguage: String,
    ipAddress: String,
    ip: String,
    location: String,
    browser: String,
    os: { type: String, required: true },
    operatingSystem: String,
    deviceType: String,
    loginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + SESSION_CONFIG.inactivityMs),
    },
    revokedAt: Date,
  },
  { timestamps: true },
);
SessionSchema.pre("validate", function syncSessionAliases() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
  this.ip = this.ip || this.ipAddress;
  this.ipAddress = this.ipAddress || this.ip;
  this.os = this.os || this.operatingSystem || "Unknown";
  this.operatingSystem = this.operatingSystem || this.os;
  if (this.isTrusted === true) this.trusted = true;
  this.isTrusted = Boolean(this.trusted);
  if (this.revokedAt) this.isRevoked = true;
});
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ user: 1, purpose: 1, lastActiveAt: -1 });

export const Session =
  mongoose.models.Session || mongoose.model("Session", SessionSchema);