import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import {
  Bookmark,
  Comment,
  Follow,
  Like,
  Notification,
  Post,
  Report,
  User,
} from "@/lib/models";
import { plans } from "@/lib/plans";
import { checkPrivilege } from "@/lib/reputation";
import { REPUTATION_PRIVILEGES } from "@/lib/reputation-policy.mjs";
import { getCurrentSubscription } from "@/lib/subscriptions";

export async function handleFeedAction(request, context = {}, forcedAction) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    const action = forcedAction || body.action;
    if (!action)
      throw Object.assign(new Error("An action is required."), { status: 400 });
    await connectDB();

    if (action === "follow") {
      const target = await User.findById(body.userId);
      if (!target || String(target._id) === String(user._id))
        throw Object.assign(new Error("Invalid follow target."), { status: 400 });
      const existing = await Follow.findOne({ follower: user._id, following: target._id });
      if (existing) {
        await existing.deleteOne();
        return NextResponse.json({ following: false });
      }
      await Follow.create({ follower: user._id, following: target._id });
      await Notification.create({ recipient: target._id, actor: user._id, type: "follow" });
      return NextResponse.json({ following: true });
    }

    const postId = context.params?.id || body.postId;
    if (!postId)
      throw Object.assign(new Error("postId is required."), { status: 400 });
    const post = await Post.findOne({ _id: postId, status: "active" });
    if (!post)
      throw Object.assign(new Error("Post not found."), { status: 404 });

    if (action === "like") {
      const existing = await Like.findOne({ post: post._id, user: user._id });
      if (existing) {
        await existing.deleteOne();
        await Post.updateOne(
          { _id: post._id },
          [{ $set: {
            likes: { $filter: { input: { $ifNull: ["$likes", []] }, as: "like", cond: { $ne: ["$$like", user._id] } } },
            likesCount: { $max: [0, { $subtract: [{ $ifNull: ["$likesCount", 1] }, 1] }] },
          } }],
        );
        return NextResponse.json({ liked: false });
      }
      await Like.create({ post: post._id, user: user._id });
      await Post.updateOne({ _id: post._id }, { $addToSet: { likes: user._id }, $inc: { likesCount: 1 } });
      if (String(post.author) !== String(user._id))
        await Notification.create({ recipient: post.author, actor: user._id, type: "like", post: post._id });
      return NextResponse.json({ liked: true });
    }

    if (action === "comment") {
      const commenter = user;
      if (
        user.role !== "admin" &&
        !checkPrivilege(user.reputation, REPUTATION_PRIVILEGES.comment)
      )
        throw Object.assign(
          new Error(
            `Commenting requires at least ${REPUTATION_PRIVILEGES.comment} reputation points.`,
          ),
          { status: 403 },
        );
      requireFields(body, ["body"]);
      if (body.body.length > 2000)
        throw Object.assign(new Error("Comment is too long."), { status: 400 });
      const comment = await Comment.create({
        post: post._id,
        author: commenter._id,
        parent: body.parent || null,
        body: body.body.trim(),
      });
      await Post.updateOne({ _id: post._id }, { $addToSet: { comments: comment._id }, $inc: { commentsCount: 1 } });
      if (String(post.author) !== String(commenter._id))
        await Notification.create({ recipient: post.author, actor: commenter._id, type: "comment", post: post._id });
      const mentions = [...new Set([...body.body.matchAll(/@([a-zA-Z0-9._-]{1,40})/g)].map((match) => match[1].toLowerCase()))];
      if (mentions.length) {
        const mentioned = await User.find({
          $or: mentions.map((name) => ({
            email: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@`, "i"),
          })),
        }).select("_id");
        if (mentioned.length)
          await Notification.insertMany(mentioned
            .filter((person) => String(person._id) !== String(commenter._id))
            .map((person) => ({ recipient: person._id, actor: commenter._id, type: "mention", post: post._id })));
      }
      return NextResponse.json({ comment });
    }

    if (action === "bookmark") {
      const existing = await Bookmark.findOne({ user: user._id, post: post._id });
      if (existing) {
        await existing.deleteOne();
        await Post.updateOne({ _id: post._id }, { $pull: { bookmarks: user._id } });
        return NextResponse.json({ bookmarked: false });
      }
      const subscription = await getCurrentSubscription(user._id);
      const plan = plans.find((item) => item.slug === subscription?.plan) || plans[0];
      if (["free", "bronze"].includes(plan.slug) && await Bookmark.countDocuments({ user: user._id }) >= 5)
        throw Object.assign(new Error("Silver and Gold plans include unlimited bookmarks."), { status: 403 });
      await Bookmark.create({ user: user._id, post: post._id });
      await Post.updateOne({ _id: post._id }, { $addToSet: { bookmarks: user._id } });
      return NextResponse.json({ bookmarked: true });
    }

    if (action === "share") {
      await Post.updateOne({ _id: post._id }, { $inc: { shareCount: 1, shares: 1 } });
      return NextResponse.json({ ok: true, shareCount: (post.shareCount || 0) + 1 });
    }

    if (action === "report") {
      if (
        user.role !== "admin" &&
        !checkPrivilege(
          user.reputation,
          REPUTATION_PRIVILEGES.reportInappropriateContent,
        )
      )
        throw Object.assign(
        new Error(
          `Reporting inappropriate content requires ${REPUTATION_PRIVILEGES.reportInappropriateContent} reputation points.`,
        ),
          { status: 403 },
        );
      requireFields(body, ["reason"]);
      await Report.create({ post: post._id, reportedBy: user._id, reporter: user._id, reason: body.reason.slice(0, 500), status: "pending" });
      const authorPostIds = await Post.distinct("_id", { author: post.author });
      if (await Report.countDocuments({ post: { $in: authorPostIds } }) > 3)
        await User.updateOne({ _id: post.author }, { $set: { isSuspended: true, suspendedAt: new Date() } });
      return NextResponse.json({ reported: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
