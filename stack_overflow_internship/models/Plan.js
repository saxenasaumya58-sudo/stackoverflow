import mongoose from "mongoose";

const { Schema } = mongoose;
const PlanSchema = new Schema(
  {
    slug: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      unique: true,
      required: true,
    },
    name: { type: String, enum: ["Free", "Bronze", "Silver", "Gold"] },
    price: Number,
    questionLimit: Number,
    dailyQuestions: Number,
    badge: String,
    features: [String],
    searchPriority: Number,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PlanSchema.pre("validate", function syncQuestionLimit() {
  if (this.dailyQuestions === undefined || this.dailyQuestions === null)
    this.dailyQuestions = this.questionLimit;
  else
    this.questionLimit = this.dailyQuestions;
});

export const Plan = mongoose.models.Plan || mongoose.model("Plan", PlanSchema);