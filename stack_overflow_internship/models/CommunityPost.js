import mongoose from "mongoose";

const { Schema } = mongoose;
const legacyTypeToPostType = {
  "technical update": "update",
  image: "image",
  "code snippet": "code",
  "project showcase": "project",
  "learning achievement": "achievement",
};
const postTypeToLegacyType = Object.fromEntries(
  Object.entries(legacyTypeToPostType).map(([legacy, current]) => [current, legacy]),
);
const CommunityPostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", index: true },
    content: { type: String, required: true, maxlength: 5000 },
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },
    codeSnippet: { type: String, default: "" },
    code: { type: String, default: "" },
    projectShowcase: { type: String, default: "" },
    learningAchievement: { type: String, default: "" },
    type: { type: String, enum: Object.keys(legacyTypeToPostType) },
    postType: { type: String, enum: ["update", "image", "code", "project", "achievement"], default: "update" },
    hashtags: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    bookmarks: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
    isTrending: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false, index: true },
    boostScore: { type: Number, default: 0, min: 0, index: true },
    trendingScore: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "removed"], default: "active", index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    editedAt: Date,
  },
  { timestamps: true },
);
CommunityPostSchema.pre("validate", function syncPostFields() {
  this.userId = this.userId || this.author;
  this.author = this.author || this.userId;
  if (this.isModified("type") && this.type)
    this.postType = legacyTypeToPostType[this.type] || this.postType;
  else if (this.postType)
    this.type = postTypeToLegacyType[this.postType];
  this.codeSnippet = this.codeSnippet || this.code;
  this.code = this.code || this.codeSnippet;
  if (!this.images.length && this.imageUrl) this.images = [this.imageUrl];
  else if (this.images.length) this.imageUrl = this.images[0];
  this.shares = Math.max(this.shares || 0, this.shareCount || 0);
  this.shareCount = this.shares;
});
CommunityPostSchema.index({ createdAt: -1, status: 1 });
CommunityPostSchema.index({ content: "text", hashtags: "text" });

export const Post = mongoose.models.Post || mongoose.model("Post", CommunityPostSchema);
export const CommunityPost = Post;