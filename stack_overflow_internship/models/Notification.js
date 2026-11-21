import mongoose from "mongoose";

const { Schema } = mongoose;
const NotificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["like", "comment", "follow", "mention"], required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post" },
    post: { type: Schema.Types.ObjectId, ref: "Post" },
    read: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true },
);
NotificationSchema.pre("validate", function syncNotificationAliases() {
  this.sender = this.sender || this.actor;
  this.actor = this.actor || this.sender;
  this.postId = this.postId || this.post;
  this.post = this.post || this.postId;
  if (this.readAt) this.read = true;
  if (this.read && !this.readAt) this.readAt = new Date();
});
NotificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
export default Notification;