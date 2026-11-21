import mongoose from "mongoose";

const { Schema } = mongoose;
const CloseVoteSchema = new Schema({
  question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
});
CloseVoteSchema.index({ question: 1, user: 1 }, { unique: true });

export const CloseVote = mongoose.models.CloseVote || mongoose.model("CloseVote", CloseVoteSchema);
export default CloseVote;
