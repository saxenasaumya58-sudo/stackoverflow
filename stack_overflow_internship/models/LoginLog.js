import mongoose from "mongoose";

const { Schema } = mongoose;
const LoginLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  browser: String,
  os: String,
  operatingSystem: String,
  deviceLabel: String,
  deviceType: String,
  ip: String,
  ipAddress: String,
  location: String,
  deviceId: String,
  loginAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

LoginLogSchema.pre("validate", function syncLoginLogAliases() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
  this.os = this.os || this.operatingSystem;
  this.operatingSystem = this.operatingSystem || this.os;
  this.ip = this.ip || this.ipAddress;
  this.ipAddress = this.ipAddress || this.ip;
  this.loginAt = this.loginAt || this.createdAt || new Date();
  this.createdAt = this.createdAt || this.loginAt;
});

export const LoginLog =
  mongoose.models.LoginLog || mongoose.model("LoginLog", LoginLogSchema);