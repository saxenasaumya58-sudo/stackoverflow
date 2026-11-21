import mongoose from "mongoose";

const { Schema } = mongoose;
const CommentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
export default Comment;
