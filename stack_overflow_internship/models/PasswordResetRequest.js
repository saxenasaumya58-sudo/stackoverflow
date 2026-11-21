import mongoose from "mongoose";

const { Schema } = mongoose;
const PasswordResetRequestSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  last_requested_at: { type: Date, required: true },
});

export const PasswordResetRequest =
  mongoose.models.PasswordResetRequest ||
  mongoose.model("PasswordResetRequest", PasswordResetRequestSchema);