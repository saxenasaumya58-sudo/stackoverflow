import mongoose from "mongoose";

const { Schema } = mongoose;
const ReputationLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    relatedId: { type: Schema.Types.ObjectId, default: null },
    points: { type: Number, required: true },
    type: { type: String, required: true },
    reason: { type: String, required: true },
    reference: String,
    balanceApplied: { type: Boolean, default: true, select: false },
  },
  { timestamps: true },
);
ReputationLogSchema.index({ user: 1, createdAt: -1 });
ReputationLogSchema.pre("validate", function syncUserAliases() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
});
ReputationLogSchema.index(
  { user: 1, reason: 1, reference: 1 },
  { unique: true, sparse: true },
);

export const ReputationLog =
  mongoose.models.ReputationLog ||
  mongoose.model("ReputationLog", ReputationLogSchema);