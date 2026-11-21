import mongoose from "mongoose";

const { Schema } = mongoose;
const VoteSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  targetType: { type: String, enum: ["question", "answer"], required: true },
  target: { type: Schema.Types.ObjectId, required: true },
  value: { type: Number, enum: [-1, 1], required: true },
});
VoteSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model("Vote", VoteSchema);
export default Vote;
