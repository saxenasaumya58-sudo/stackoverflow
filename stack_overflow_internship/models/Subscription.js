import mongoose from "mongoose";

const { Schema } = mongoose;
const BillingDetailsSchema = new Schema(
  { name: String, email: String, address: String },
  { _id: false },
);
const SubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      required: true,
    },
    invoiceNumber: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "pending"],
      default: "pending",
    },
    startedAt: Date,
    startDate: Date,
    renewalDate: Date,
    active: Boolean,
    billingDetails: { type: BillingDetailsSchema, default: () => ({}) },
    razorpayOrderId: String,
    razorpayPaymentId: String,
  },
  { timestamps: true },
);
SubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });
SubscriptionSchema.index({ user: 1, status: 1, createdAt: -1 });

SubscriptionSchema.pre("validate", function syncSubscriptionAliases() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
  if (this.startedAt) this.startDate = this.startedAt;
  else if (this.startDate) this.startedAt = this.startDate;
  this.active = this.status === "active";
});

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", SubscriptionSchema);