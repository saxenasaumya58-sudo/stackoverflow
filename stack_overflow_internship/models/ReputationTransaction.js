import mongoose from "mongoose";
import { REPUTATION_TRANSFER_POLICY } from "../lib/reputation-policy.mjs";

const { Schema } = mongoose;
const ReputationTransactionSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    points: {
      type: Number,
      min: REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction,
      max: REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction,
      required: true,
    },
    reason: { type: String, required: true, maxlength: 250 },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    stage: {
      type: String,
      enum: ["pending", "debited", "credited", "refund_pending", "refunded"],
      default: "pending",
    },
    failureReason: String,
    leaseToken: String,
    leaseUntil: Date,
  },
  { timestamps: true },
);
ReputationTransactionSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
ReputationTransactionSchema.index({ sender: 1, createdAt: -1 });
ReputationTransactionSchema.index({ receiver: 1, createdAt: -1 });

export const ReputationTransaction =
  mongoose.models.ReputationTransaction ||
  mongoose.model("ReputationTransaction", ReputationTransactionSchema);