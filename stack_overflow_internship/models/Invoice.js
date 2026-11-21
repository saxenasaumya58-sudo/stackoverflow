import mongoose from "mongoose";
import crypto from "node:crypto";

const { Schema } = mongoose;
const InvoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, unique: true, required: true },
    invoiceId: { type: String, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: { type: String, enum: ["free", "bronze", "silver", "gold"] },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
    planName: String,
    amount: { type: Number, enum: [0, 99, 299, 999] },
    currency: { type: String, default: "INR" },
    date: Date,
    paidAt: Date,
    renewalDate: Date,
    pdfUrl: String,
    paymentId: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    emailSent: { type: Boolean, default: false },
    emailSentAt: Date,
    emailError: String,
  },
  { timestamps: true },
);
InvoiceSchema.index({ userId: 1, date: -1 });
InvoiceSchema.index({ user: 1, date: -1 });

InvoiceSchema.pre("validate", function assignInvoiceId() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
  this.subscriptionId = this.subscriptionId || this.subscription;
  this.subscription = this.subscription || this.subscriptionId;
  if (!this.invoiceNumber)
    this.invoiceNumber = `INV-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  this.invoiceId = this.invoiceId || this.invoiceNumber;
  this.invoiceNumber = this.invoiceNumber || this.invoiceId;
  if (this.paidAt) this.date = this.paidAt;
  else if (this.date) this.paidAt = this.date;
  if (this.paymentId) this.razorpayPaymentId = this.paymentId;
  else if (this.razorpayPaymentId) this.paymentId = this.razorpayPaymentId;
});

export const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);