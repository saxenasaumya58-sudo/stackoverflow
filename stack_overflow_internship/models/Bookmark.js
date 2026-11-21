import mongoose from "mongoose";

const { Schema } = mongoose;
const BookmarkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  },
  { timestamps: true },
);
BookmarkSchema.pre("validate", function syncBookmarkAliases() {
  this.userId = this.userId || this.user;
  this.user = this.user || this.userId;
  this.postId = this.postId || this.post;
  this.post = this.post || this.postId;
});
BookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", BookmarkSchema);