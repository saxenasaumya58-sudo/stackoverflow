import mongoose from "mongoose";

const { Schema } = mongoose;
const AnswerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 10000 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    accepted: { type: Boolean, default: false },
    bonusAwardedAt: Date,
  },
  { timestamps: true },
);

export const Answer = mongoose.models.Answer || mongoose.model("Answer", AnswerSchema);
export default Answer;
