import mongoose from "mongoose";

const { Schema } = mongoose;
const QuestionSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 180 },
    body: { type: String, required: true, maxlength: 10000 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false, index: true },
    boostScore: { type: Number, default: 0, min: 0, index: true },
    status: { type: String, default: "open" },
  },
  { timestamps: true },
);

export const Question =
  mongoose.models.Question || mongoose.model("Question", QuestionSchema);