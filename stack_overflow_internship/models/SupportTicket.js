import mongoose from "mongoose";

const { Schema } = mongoose;
const SupportTicketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 5000 },
    priority: { type: String, enum: ["low", "high"], required: true, index: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  },
  { timestamps: true },
);

export const SupportTicket =
  mongoose.models.SupportTicket ||
  mongoose.model("SupportTicket", SupportTicketSchema);