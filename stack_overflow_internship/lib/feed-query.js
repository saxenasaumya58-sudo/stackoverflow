import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Follow, Post } from "@/lib/models";

function viewerStateStages(currentUserId) {
  if (!currentUserId)
    return [{ $addFields: { isLiked: false, isBookmarked: false } }];
  return [
    {
      $lookup: {
        from: "bookmarks",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$post", "$$postId"] },
                  { $eq: ["$user", currentUserId] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "viewerBookmarks",
      },
    },
    { $addFields: { isBookmarked: { $gt: [{ $size: "$viewerBookmarks" }, 0] } } },
  ];
}

function engagementStages(currentUserId) {
  const likedByViewer = currentUserId
    ? { $eq: ["$user", currentUserId] }
    : false;
  return [
    {
      $lookup: {
        from: "likes",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$post", "$$postId"] } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              isLiked: {
                $max: { $cond: [likedByViewer, 1, 0] },
              },
            },
          },
        ],
        as: "likeStats",
      },
    },
    {
      $lookup: {
        from: "comments",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$post", "$$postId"] } } },
          { $count: "count" },
        ],
        as: "commentStats",
      },
    },
    {
      $addFields: {
        likes: { $ifNull: [{ $arrayElemAt: ["$likeStats.count", 0] }, 0] },
        comments: {
          $ifNull: [{ $arrayElemAt: ["$commentStats.count", 0] }, 0],
        },
        isLiked: {
          $gt: [
            { $ifNull: [{ $arrayElemAt: ["$likeStats.isLiked", 0] }, 0] },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        engagement: {
          $add: ["$likes", "$comments"],
        },
        trendingScore: {
          $add: ["$likes", "$comments"],
        },
      },
    },
  ];
}

export async function getFeedPage({ page = 1, limit = 10, tag, hashtag, sort, filter, followingUserId, currentUserId }) {
  const selectedHashtag = hashtag || tag;
  if (sort === "trending") {
    return getTrendingPosts({ page, limit, tag: selectedHashtag, followingUserId, currentUserId });
  }
  await connectDB();
  const postFilter = {
    status: "active",
    isDeleted: { $ne: true },
    ...(selectedHashtag ? { hashtags: selectedHashtag.replace(/^#/, "").toLowerCase() } : {}),
  };
  if (followingUserId) {
    const follows = await Follow.find({ follower: followingUserId }).select("following").lean();
    postFilter.author = { $in: follows.map((item) => item.following) };
  }
  const followedAuthorIds =
    currentUserId && !followingUserId
      ? await Follow.find({ follower: currentUserId }).distinct("following")
      : [];
  const pipeline = [
    { $match: postFilter },
    { $addFields: { userId: "$author" } },
    ...(followedAuthorIds.length
      ? [
          {
            $addFields: {
              isFollowedAuthor: { $in: ["$author", followedAuthorIds] },
            },
          },
        ]
      : []),
    {
      $sort: {
        ...(followedAuthorIds.length ? { isFollowedAuthor: -1 } : {}),
        isFeatured: -1,
        boostScore: -1,
        createdAt: -1,
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    ...engagementStages(currentUserId),
    ...viewerStateStages(currentUserId),
    { $lookup: { from: "users", localField: "author", foreignField: "_id", as: "author" } }, { $unwind: "$author" },
    { $project: { "author.passwordHash": 0, "author.email": 0, "author.phone": 0, likeStats: 0, commentStats: 0, isFollowedAuthor: 0 } },
  ];
  const [posts, total] = await Promise.all([
    Post.aggregate(pipeline),
    Post.countDocuments(postFilter),
  ]);
  const hasMore = page * limit < total;
  return { posts: JSON.parse(JSON.stringify(posts)), page, limit, total, hasMore };
}

export async function getTrendingPosts({ page = 1, limit = 10, tag, followingUserId, currentUserId } = {}) {
  await connectDB();
  const filter = {
    status: "active",
    isDeleted: { $ne: true },
    ...(tag ? { hashtags: tag.replace(/^#/, "").toLowerCase() } : {}),
  };
  if (followingUserId) {
    const follows = await Follow.find({ follower: followingUserId }).select("following").lean();
    filter.author = { $in: follows.map((item) => item.following) };
  }
  const [posts, total] = await Promise.all([
    Post.aggregate([
      { $match: filter },
      { $addFields: { userId: "$author" } },
      ...engagementStages(currentUserId),
      ...viewerStateStages(currentUserId),
      { $sort: { trendingScore: -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: "users", localField: "author", foreignField: "_id", as: "author" } },
      { $unwind: "$author" },
      { $project: { "author.passwordHash": 0, "author.email": 0, "author.phone": 0, likeStats: 0, commentStats: 0 } },
    ]),
    Post.countDocuments(filter),
  ]);
  const hasMore = page * limit < total;
  return { posts: JSON.parse(JSON.stringify(posts)), page, limit, total, hasMore };
}

export async function getTrendingTags({ limit = 12 } = {}) {
  await connectDB();
  return Post.aggregate([
    { $match: { status: "active", isDeleted: { $ne: true }, "hashtags.0": { $exists: true } } },
    { $unwind: "$hashtags" },
    { $group: { _id: "$hashtags", posts: { $addToSet: "$_id" } } },
    { $project: { _id: 0, tag: "$_id", postCount: { $size: "$posts" } } },
    { $sort: { postCount: -1, tag: 1 } },
    { $limit: limit },
  ]);
}

export function objectId(value) { return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null; }