import mongoose from "mongoose";

const { Schema } = mongoose;
const ReportSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", index: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User" },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reporter: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "reviewed", "removed", "open", "dismissed"], default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true },
);
ReportSchema.pre("validate", function syncReportFields() {
  this.postId = this.postId || this.post;
  this.post = this.post || this.postId;
  this.reporterId = this.reporterId || this.reportedBy || this.reporter;
  this.reportedBy = this.reportedBy || this.reporterId;
  this.reporter = this.reporter || this.reporterId;
});

export const Report = mongoose.models.Report || mongoose.model("Report", ReportSchema);