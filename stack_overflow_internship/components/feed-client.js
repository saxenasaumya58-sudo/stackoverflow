"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getCachedFeed,
  getCachedTrendingTags,
  getFeed,
  getTrendingTags,
  refreshFeed,
} from "@/lib/feed-data";
import {
  fetchClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Code2,
  Flag,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import QuestionComposer from "@/components/question-composer";
import {
  hasReputationPrivilege,
  REPUTATION_PRIVILEGES,
} from "@/lib/reputation-policy.mjs";

const seed = [
  {
    _id: "demo-1",
    type: "project showcase",
    contentKey: "ui.samplePostAccessibility",
    hashtags: ["buildinpublic", "accessibility", "opensource"],
    author: {
      name: "Maya Chen",
      handle: "mayacodes",
      avatar: "MC",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=85",
    likes: 48,
    comments: 12,
    timeKey: "ui.sampleTime24MinAgo",
    liked: false,
  },
  {
    _id: "demo-2",
    type: "technical update",
    contentKey: "ui.samplePostPerformance",
    hashtags: ["react", "performance"],
    author: {
      name: "Leo Martins",
      handle: "leomakes",
      avatar: "LM",
    },
    likes: 31,
    comments: 8,
    timeKey: "ui.sampleTimeOneHourAgo",
    liked: false,
  },
  {
    _id: "demo-3",
    type: "learning achievement",
    contentKey: "ui.samplePostRust",
    hashtags: ["rust", "learninginpublic"],
    author: {
      name: "Aisha Patel",
      handle: "aishabuilds",
      avatar: "AP",
    },
    likes: 22,
    comments: 16,
    timeKey: "ui.sampleTimeTwoHoursAgo",
    liked: false,
  },
];
const avatarColors = [
  "bg-[#f0d4c1] text-[#71482f]",
  "bg-[#d9e6c2] text-[#405831]",
  "bg-[#d8e2f4] text-[#43587f]",
  "bg-[#f2e5ab] text-[#6d5d19]",
];

function FeedCard({ post, currentUserId, currentUserReputation, currentUserRole, followed, onFollowChange, onHashtagSelect, onPostChange, selectedHashtag }) {
  const { t } = useLanguage();
  const content = post.contentKey ? t(post.contentKey) : post.content;
  const time = post.timeKey ? t(post.timeKey) : post.time || t.justNow;
  const imageUrl = typeof post.imageUrl === "string" ? post.imageUrl.trim() : "";
  const [isFollowing, setIsFollowing] = useState(followed);
  const [followBusy, setFollowBusy] = useState(false);
  const [liked, setLiked] = useState(Boolean(post.isLiked || post.liked));
  const [saved, setSaved] = useState(Boolean(post.isBookmarked));
  const [likes, setLikes] = useState(post.likes || 0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionDialog, setActionDialog] = useState("");
  const [dialogValue, setDialogValue] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const shareToastTimeout = useRef(null);
  const avatar =
    post.author?.avatar ||
    post.author?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) ||
    "?";
  const send = async (action, body = {}) => {
    if (String(post._id).startsWith("demo-")) return null;
    setBusy(true);
    try {
      const response = await fetch(`/api/feed/${post._id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Feed interaction failed", { status: response.status, error: data.error });
        window.alert(response.status === 401 ? t.signInToAction : t.actionFailed);
        return null;
      }
      return data;
    } catch (error) {
      console.error("Feed interaction failed", error);
      window.alert(t.networkError);
      return null;
    } finally {
      setBusy(false);
    }
  };
  useEffect(
    () => () => window.clearTimeout(shareToastTimeout.current),
    [],
  );
  async function sharePost() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable.");
      }
      await navigator.clipboard.writeText(
        window.location.origin + `/feed#${post._id}`,
      );
    } catch (error) {
      console.error("Could not copy post link", error);
      window.alert(t.actionFailed);
      return;
    }

    setShareCopied(true);
    window.clearTimeout(shareToastTimeout.current);
    shareToastTimeout.current = window.setTimeout(
      () => setShareCopied(false),
      2000,
    );
    await send("share");
  }
  useEffect(() => {
    if (!showComments || String(post._id).startsWith("demo-")) return;
    fetch(`/api/feed/${post._id}/comments?page=1`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load comments.");
        setComments(data.comments);
        setCommentsPage(2);
        setCommentsHasMore(data.hasMore);
      })
      .catch((error) => {
        console.error("Comment loading failed", error);
        window.alert(t.networkError);
      });
  }, [showComments, post._id, t.networkError]);
  useEffect(() => setIsFollowing(followed), [followed]);
  const ownPost =
    currentUserId && String(post.author?._id) === String(currentUserId);
  const isAdmin = currentUserRole === "admin";
  const canComment =
    isAdmin ||
    hasReputationPrivilege(
      currentUserReputation,
      REPUTATION_PRIVILEGES.comment,
    );
  const canEditPost =
    isAdmin ||
    hasReputationPrivilege(
      currentUserReputation,
      REPUTATION_PRIVILEGES.editCommunityPost,
    );
  const canReport =
    isAdmin ||
    hasReputationPrivilege(
      currentUserReputation,
      REPUTATION_PRIVILEGES.reportInappropriateContent,
    );
  const canFollow =
    currentUserId &&
    post.author?._id &&
    String(post.author._id) !== String(currentUserId);
  async function toggleFollow() {
    setFollowBusy(true);
    try {
      const response = await fetch(`/api/users/${post.author._id}/follow`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Follow action failed", { status: response.status, error: data.error });
        window.alert(response.status === 401 ? t.signInToAction : t.actionFailed);
        return;
      }
      setIsFollowing(data.followed);
      onFollowChange(post.author._id, data.followed);
    } catch {
      window.alert(t.networkError);
    } finally {
      setFollowBusy(false);
    }
  }
  async function loadMoreComments() {
    if (loadingComments || !commentsHasMore) return;
    setLoadingComments(true);
    try {
      const response = await fetch(
        `/api/feed/${post._id}/comments?page=${commentsPage}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load comments.");
      setComments((items) => [...items, ...data.comments]);
      setCommentsPage((page) => page + 1);
      setCommentsHasMore(data.hasMore);
    } catch (error) {
      console.error("Comment loading failed", error);
      window.alert(t.networkError);
    } finally {
      setLoadingComments(false);
    }
  }
  function openActionDialog(action) {
    if (action === "report" && String(post._id).startsWith("demo-")) return;
    if (action === "edit" && !canEditPost) return;
    if (action === "report" && !canReport) return;
    setMenuOpen(false);
    setDialogError("");
    setDialogValue(action === "edit" ? post.content : "");
    setActionDialog(action);
  }
  async function submitActionDialog(event) {
    event.preventDefault();
    if (!actionDialog || dialogBusy) return;
    const value = dialogValue.trim();
    if (actionDialog !== "delete" && !value) return;
    setDialogBusy(true);
    setDialogError("");
    try {
      const response =
        actionDialog === "edit"
          ? await fetch(`/api/feed/${post._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: value }),
            })
          : actionDialog === "delete"
            ? await fetch(`/api/feed/${post._id}`, { method: "DELETE" })
            : await fetch(`/api/posts/${post._id}/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: value }),
              });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Post action failed", {
          action: actionDialog,
          status: response.status,
          error: data.error,
        });
        setDialogError(
          response.status === 401
            ? t.signInToAction
            : data.error || t.actionFailed,
        );
        return;
      }
      const action = actionDialog;
      setActionDialog("");
      if (action === "delete") onPostChange(post._id);
      if (action === "edit") onPostChange(post._id, data.post);
    } catch (error) {
      console.error("Post action failed", { action: actionDialog, error });
      setDialogError(t.networkError);
    } finally {
      setDialogBusy(false);
    }
  }
  return (
    <>
    <article
      id={post._id}
      className="overflow-hidden rounded-xl border border-[#e5e7df] bg-[#fbfbf8] px-5 py-5 shadow-[0_2px_8px_#21251a08] sm:px-6"
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-bold ${avatarColors[(post.author?.name?.length || 0) % avatarColors.length]}`}
        >
          {avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-[13px] font-semibold text-[#262c27]">
                  {post.author?.name || t.communityMember}
                </span>
                <span className="text-[11px] text-[#969c93]">
                  @{post.author?.handle || t.member}
                </span>
                <span className="text-[11px] text-[#b2b7ae]">
                  · {time}
                </span>
                {canFollow && (
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className="ml-1 text-[10px] font-semibold text-[#4777b7] hover:underline disabled:opacity-50"
                  >
                    {isFollowing ? t.following : t.follow}
                  </button>
                )}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 rounded bg-[#f1f2ed] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.7px] text-[#777f73]">
                {t.postTypes[post.type] || post.type || t.postTypes["technical update"]}
              </div>
            </div>
            <div className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((value) => !value)}
                aria-label={t.morePostActions}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a4aaa1] hover:bg-[#f2f3ee]"
              >
                <MoreHorizontal size={17} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-[#e3e5de] bg-white p-1 shadow-lg">
                  {ownPost && (
                    <>
                      <button
                        onClick={() => openActionDialog("edit")}
                        disabled={!canEditPost}
                        title={!canEditPost ? `Editing requires ${REPUTATION_PRIVILEGES.editCommunityPost} reputation points.` : undefined}
                        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] hover:bg-[#f1f2ed] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil size={13} />
                        {t.editPost}{!canEditPost && ` (${REPUTATION_PRIVILEGES.editCommunityPost} points required)`}
                      </button>
                      <button
                        onClick={() => openActionDialog("delete")}
                        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] text-[#a34c36] hover:bg-[#fff2ed]"
                      >
                        <Trash2 size={13} />
                        {t.deletePost}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openActionDialog("report")}
                    disabled={!canReport}
                    title={!canReport ? `Reporting requires ${REPUTATION_PRIVILEGES.reportInappropriateContent} reputation points.` : undefined}
                    className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[11px] hover:bg-[#f1f2ed] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Flag size={13} />
                    {t.reportPost}{!canReport && ` (${REPUTATION_PRIVILEGES.reportInappropriateContent} points required)`}
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-[13px] leading-[1.8] text-[#424a43]">
            {content.split(/(#[a-zA-Z0-9_]+)/g).map((part, index) =>
              part.startsWith("#") ? (
                <button
                  type="button"
                  key={`${part}-${index}`}
                  onClick={() => onHashtagSelect(part.slice(1))}
                  className={`font-medium text-[#3978bd] hover:underline ${selectedHashtag === part.slice(1).toLowerCase() ? "rounded bg-[#e5f1ff] px-0.5" : ""}`}
                >
                  {part}
                </button>
              ) : (
                part
              ),
            )}
          </p>
          {post.code && (
            <pre className="no-scrollbar mt-3 overflow-x-auto rounded-lg bg-[#202823] p-4 text-[11px] leading-[1.7] text-[#d9e5cd]">
              <code>{post.code}</code>
            </pre>
          )}
          {imageUrl && failedImageUrl !== imageUrl && (
            <div className="relative mt-3 aspect-[16/8] overflow-hidden rounded-lg">
              <Image
                src={imageUrl}
                alt={t("ui.sharedProjectPreview")}
                fill
                priority={post._id === "demo-1"}
                sizes="(max-width: 1280px) 90vw, 700px"
                className="object-cover"
                onError={() => setFailedImageUrl(imageUrl)}
              />
            </div>
          )}
          {!!post.hashtags?.length && (
            <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1">
              {post.hashtags.map((tag) => (
                <button
                  type="button"
                  onClick={() => onHashtagSelect(tag.replace(/^#/, ""))}
                  key={tag}
                  className={`text-[11px] font-medium text-[#3978bd] hover:underline ${selectedHashtag === tag.replace(/^#/, "").toLowerCase() ? "rounded bg-[#e5f1ff] px-1" : ""}`}
                >
                  #{tag.replace(/^#/, "")}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#8d948b]">
            <button
              aria-label={liked ? t.unlike : t.like}
              onClick={async () => {
                const previousLiked = liked;
                const previousLikes = likes;
                setLiked(!previousLiked);
                setLikes(previousLikes + (previousLiked ? -1 : 1));
                const result = await send("like");
                if (!result) {
                  setLiked(previousLiked);
                  setLikes(previousLikes);
                }
              }}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 transition hover:text-[#42652d] ${liked ? "font-semibold text-[#527936]" : ""}`}
            >
              <ThumbsUp size={15} fill={liked ? "currentColor" : "none"} />
              {likes} {t.likes}
            </button>
            <button
              onClick={() => setShowComments((value) => !value)}
              className="inline-flex items-center gap-1.5 hover:text-[#42652d]"
            >
              <MessageCircle size={15} />
              {post.comments || 0} {t.comments}
            </button>
            <button
              onClick={sharePost}
              className="inline-flex items-center gap-1.5 hover:text-[#42652d]"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">{t.share}</span>
            </button>
            <button
              onClick={async () => {
                const previousSaved = saved;
                setSaved(!previousSaved);
                const result = await send("bookmark");
                if (!result) setSaved(previousSaved);
              }}
              className={`ml-auto inline-flex items-center gap-1.5 hover:text-[#42652d] ${saved ? "text-[#527936]" : ""}`}
              aria-label={saved ? t("ui.removeBookmark") : t("ui.bookmarkPost")}
            >
              <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
              <span className="hidden sm:inline">
                {saved ? t.saved : t.savePost}
              </span>
            </button>
          </div>
          {showComments && (
            <div className="mt-4 border-t border-[#eff0eb] pt-3">
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!canComment || !comment.trim()) return;
                  const result = await send("comment", {
                    body: comment,
                    ...(replyTo ? { parent: replyTo } : {}),
                  });
                  if (result?.comment)
                    setComments((items) => [
                      ...items,
                      { ...result.comment, author: { name: t("ui.you") } },
                    ]);
                  setComment("");
                  setReplyTo(null);
                }}
                className="flex gap-2"
              >
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  disabled={!canComment}
                  placeholder={
                    canComment
                      ? replyTo ? t.writeReply : t.addComment
                      : `Commenting requires ${REPUTATION_PRIVILEGES.comment} reputation points.`
                  }
                  className="min-w-0 flex-1 rounded-md border border-[#e6e8e1] bg-white px-3 py-2 text-xs outline-none focus:border-[#9db47b]"
                />
                <button
                  disabled={!canComment || !comment.trim() || busy}
                  className="grid h-8 w-9 place-items-center rounded-md bg-[#293b29] text-white hover:bg-[#3b5738]"
                  aria-label={t.sendComment}
                >
                  <ArrowUpRight size={15} />
                </button>
              </form>
              {!canComment && (
                <p className="mt-2 text-[10px] text-[#994b36]">
                  Commenting requires {REPUTATION_PRIVILEGES.comment} reputation points.
                </p>
              )}
              <div className="mt-3 space-y-3">
                {comments.map((item) => (
                  <div
                    key={item._id}
                    className={`border-l-2 border-[#dfe8d3] pl-3 ${item.parent ? "ml-5" : ""}`}
                  >
                    <p className="text-[10px] font-semibold">
                      {item.author?.name || t.communityMember}
                      <span className="ml-2 font-normal text-[#9da39a]">
                        {item.body}
                      </span>
                    </p>
                    <button
                      onClick={() => setReplyTo(item._id)}
                      className="mt-1 text-[9px] font-medium text-[#668348]"
                    >
                      {t.reply}
                    </button>
                  </div>
                ))}
              </div>
              {commentsHasMore && (
                <button
                  onClick={loadMoreComments}
                  disabled={loadingComments}
                  className="mt-3 text-[10px] font-medium text-[#668348] disabled:opacity-60"
                >
                  {loadingComments ? t.pleaseWait : t.seeAll}
                </button>
              )}
              <p className="mt-2 text-[10px] text-[#a1a69f]">
                {t.repliesPublic}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
    {shareCopied && (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#202823] px-4 py-2 text-sm font-medium text-white shadow-lg"
      >
        {t.linkCopied}
      </div>
    )}
    {actionDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152019]/40 p-4 backdrop-blur-[2px]">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby={`post-action-title-${post._id}`}
          onSubmit={submitActionDialog}
          className="w-full max-w-[500px] rounded-2xl border border-[#e1e4da] bg-[#fbfbf8] p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2
              id={`post-action-title-${post._id}`}
              className="text-[17px] font-semibold"
            >
              {actionDialog === "edit"
                ? t.editPost
                : actionDialog === "delete"
                  ? t.deletePost
                  : t.reportPost}
            </h2>
            <button
              type="button"
              onClick={() => setActionDialog("")}
              disabled={dialogBusy}
              className="grid h-8 w-8 place-items-center rounded-md text-[#848b82] hover:bg-[#eff0eb] disabled:opacity-50"
              aria-label={t.close}
            >
              <X size={17} />
            </button>
          </div>
          {actionDialog === "delete" ? (
            <p className="mt-4 text-[12px] text-[#626a61]">
              {t.deletePostConfirm}
            </p>
          ) : (
            <textarea
              autoFocus
              required
              value={dialogValue}
              onChange={(event) => setDialogValue(event.target.value)}
              maxLength={actionDialog === "edit" ? 5000 : 500}
              aria-label={
                actionDialog === "edit" ? t.editPost : t.reportPost
              }
              placeholder={actionDialog === "report" ? t.reason : undefined}
              rows={actionDialog === "edit" ? 6 : 4}
              className="mt-4 w-full resize-y rounded-lg border border-[#e4e6de] bg-white p-3 text-[13px] leading-relaxed outline-none focus:border-[#91ad71]"
            />
          )}
          {dialogError && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]"
            >
              {dialogError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActionDialog("")}
              disabled={dialogBusy}
              className="h-9 rounded-lg px-4 text-[11px] text-[#7c847b] hover:bg-[#f0f1eb] disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={
                dialogBusy ||
                (actionDialog !== "delete" && !dialogValue.trim())
              }
              className={`h-9 rounded-lg px-4 text-[11px] font-semibold text-white disabled:opacity-50 ${
                actionDialog === "delete"
                  ? "bg-[#a75138] hover:bg-[#883f2c]"
                  : "bg-[#293b29] hover:bg-[#3b5738]"
              }`}
            >
              {dialogBusy
                ? t.pleaseWait
                : actionDialog === "edit"
                  ? t.save
                  : actionDialog === "delete"
                    ? t.deletePost
                    : t.reportPost}
            </button>
          </div>
        </form>
      </div>
    )}
    </>
  );
}

export default function FeedClient({
  initial = {},
  tag = "",
  hashtag: initialHashtag = "",
  sort = "",
  following = false,
  filter = "all",
  initialLimit = 10,
}) {
  const router = useRouter();
  const { t, user } = useLanguage();
  const [posts, setPosts] = useState(initial.demo ? seed : initial.posts || []);
  const [page, setPage] = useState((initial.page || 1) + 1);
  const [limit] = useState(initialLimit);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(!!initial.hasMore);
  const [compose, setCompose] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState("technical update");
  const [imageUrl, setImageUrl] = useState("");
  const [code, setCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(user?.id || "");
  const [followedUserIds, setFollowedUserIds] = useState(new Set());
  const followingCacheKey = `feed:following:${user?.id || "guest"}`;
  const suggestionsCacheKey = `feed:suggestions:${user?.id || "guest"}`;
  const [suggestions, setSuggestions] = useState(
    () => readClientCache(suggestionsCacheKey) || [],
  );
  const [trendingTags, setTrendingTags] = useState(
    () => getCachedTrendingTags() || null,
  );
  const [trendingTagsError, setTrendingTagsError] = useState("");
  const [activeFilter, setActiveFilter] = useState(
    filter !== "all" ? filter : following ? "following" : sort === "trending" ? "trending" : "all",
  );
  const [hashtag, setHashtag] = useState(initialHashtag || tag);
  const marker = useRef(null);
  const loadingRef = useRef(false);
  const previousInitial = useRef(initial);
  useEffect(() => {
    if (previousInitial.current === initial) return;
    previousInitial.current = initial;
    setPosts((current) => [
      ...(initial.demo ? seed : initial.posts || []),
      ...current.slice(initial.posts?.length || 0),
    ]);
    setPage((current) => Math.max(current, (initial.page || 1) + 1));
    setHasMore(Boolean(initial.hasMore));
  }, [initial]);
  useEffect(() => {
    let active = true;
    const hadCache = Boolean(getCachedTrendingTags());
    getTrendingTags({ revalidate: hadCache })
      .then((tags) => {
        if (active) {
          setTrendingTags(tags);
          setTrendingTagsError("");
        }
      })
      .catch((error) => {
        console.error("Trending tags failed to load", error);
        if (active && !hadCache) setTrendingTagsError(t.networkError);
      });
    return () => {
      active = false;
    };
  }, [t.networkError]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadedPage = Math.max(1, page - 1);
    if (loadedPage === 1) params.delete("page");
    else params.set("page", String(loadedPage));
    const query = params.toString();
    router.replace(`/feed${query ? `?${query}` : ""}`, { scroll: false });
  }, [page, router]);
  useEffect(() => {
    setCurrentUserId(user?.id || "");
    const cachedFollowing = readClientCache(followingCacheKey);
    if (cachedFollowing) setFollowedUserIds(new Set(cachedFollowing));
    const cachedSuggestions = readClientCache(suggestionsCacheKey);
    if (cachedSuggestions) setSuggestions(cachedSuggestions);
    const followingRequest = user?.id
      ? fetchClientCache(
          followingCacheKey,
          async () => {
            const response = await fetch("/api/users?following=true");
            if (!response.ok) throw new Error("Unable to load followed users.");
            const data = await response.json();
            return data.followingIds || [];
          },
          { revalidate: Boolean(cachedFollowing) },
        )
      : Promise.resolve([]);
    followingRequest
      .then((ids) => setFollowedUserIds(new Set(ids)))
      .catch((error) => console.error("Followed users failed to load", error));
    fetchClientCache(
      suggestionsCacheKey,
      async () => {
        const response = await fetch("/api/users/suggestions");
        if (!response.ok) throw new Error("Unable to load user suggestions.");
        const data = await response.json();
        return data.suggestions || [];
      },
      { revalidate: Boolean(cachedSuggestions) },
    )
      .then(setSuggestions)
      .catch((error) => console.error("User suggestions failed to load", error));
  }, [user?.id, followingCacheKey, suggestionsCacheKey]);
  useEffect(() => {
    async function loadPage(nextPage) {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const query = {
        page: nextPage,
        limit,
        filter: activeFilter,
        hashtag,
        sort: activeFilter === "trending" ? "trending" : "",
      };
      const cached = getCachedFeed(query);
      if (!cached) setLoading(true);
      try {
        const data = cached || await getFeed(query);
        setPosts((items) => {
          if (cached && items.some((item) => item._id === data.posts?.[0]?._id))
            return items;
          return [...items, ...data.posts];
        });
        setPage(nextPage + 1);
        setHasMore(data.hasMore);
      } catch {
        if (!cached) setHasMore(false);
      } finally {
        loadingRef.current = false;
        if (!cached) setLoading(false);
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) loadPage(page);
      },
      { rootMargin: "250px" },
    );
    if (marker.current) observer.observe(marker.current);
    return () => {
      observer.disconnect();
    };
  }, [page, limit, hasMore, loading, activeFilter, hashtag]);
  async function changeFeed(nextFilter, nextHashtag = hashtag) {
    setActiveFilter(nextFilter);
    setHashtag(nextHashtag);
    setPosts([]);
    setHasMore(false);
    setPage(1);
    const query = {
      page: 1,
      limit,
      filter: nextFilter,
      hashtag: nextHashtag,
      sort: nextFilter === "trending" ? "trending" : "",
    };
    const cached = getCachedFeed(query);
    setPosts(cached?.posts || []);
    setHasMore(Boolean(cached?.hasMore));
    setPage(cached ? (cached.page || 1) + 1 : 1);
    setLoading(!cached);
    loadingRef.current = true;
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    if (nextHashtag) params.set("hashtag", nextHashtag);
    router.push(`/feed${params.size ? `?${params}` : ""}`);
    try {
      const data = cached
        ? await refreshFeed(query)
        : await getFeed(query);
      setPosts((current) => cached ? [...(data.posts || []), ...current.slice(data.posts?.length || 0)] : data.posts || []);
      setPage((data.page || 1) + 1);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      if (!cached) {
        setPosts([]);
        setHasMore(false);
      }
      console.error("Feed loading failed", error);
      if (!cached) window.alert(t.networkError);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }
  function updateFollowedUser(userId, followed) {
    setFollowedUserIds((current) => {
      const next = new Set(current);
      if (followed) next.add(String(userId));
      else next.delete(String(userId));
      writeClientCache(followingCacheKey, [...next]);
      return next;
    });
    if (!followed && activeFilter === "following") {
      setPosts((items) =>
        items.filter((post) => String(post.author?._id) !== String(userId)),
      );
    }
  }
  async function uploadImage(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024)
      return window.alert(t.imageSizeLimit);
    setUploading(true);
    try {
      const signed = await fetch("/api/upload/signature", { method: "POST" });
      const signature = await signed.json().catch(() => ({}));
      if (!signed.ok)
        throw new Error(signature.error || t.imageUploadFailed);
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signature.apiKey);
      form.append("timestamp", signature.timestamp);
      if (signature.uploadPreset)
        form.append("upload_preset", signature.uploadPreset);
      form.append("signature", signature.signature);
      const uploaded = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      const result = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok)
        throw new Error(result.error?.message || t.imageUploadFailed);
      setImageUrl(result.secure_url);
    } catch (error) {
      console.error("Image upload failed", error);
      window.alert(error instanceof Error ? error.message : t.imageUploadFailed);
    } finally {
      setUploading(false);
    }
  }
  async function createPost(event) {
    event.preventDefault();
    try {
      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type, imageUrl, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Post creation failed", { status: response.status, error: data.error });
        return window.alert(response.status === 401 ? t.signInToAction : t.actionFailed);
      }
      setPosts((items) => [data.post, ...items]);
      setContent("");
      setImageUrl("");
      setCode("");
      setCompose(false);
    } catch (error) {
      console.error("Post creation failed", error);
      window.alert(t.networkError);
    }
  }
  return (
    <div className="page-enter mx-auto grid max-w-[1120px] grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
      <section className="min-w-0">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.4px] text-[#839274]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#98c262]" />
              {t.weeklyPulse}
            </div>
            <h1 className="text-[27px] font-semibold tracking-[-1px] sm:text-[31px]">
              {t.feed},{" "}
              <span className="font-normal text-[#92988e]">{t.inMotion}</span>
            </h1>
            <p className="mt-1.5 text-[12px] text-[#8b928a]">
              {tag
                ? `${t.conversationsTagged} #${tag}`
                : t.feedIntro}
            </p>
          </div>
          <button
            onClick={() => setCompose(true)}
            className="hidden h-10 shrink-0 items-center gap-2 rounded-lg bg-[#c7f36b] px-4 text-[12px] font-semibold text-[#26361f] shadow-[0_2px_0_#94bf4a] transition hover:-translate-y-0.5 sm:flex"
          >
            <Plus size={16} />
            {t.newPost}
          </button>
        </div>
        <div className="mb-4 flex h-11 items-center gap-1 rounded-lg border border-[#e8e9e2] bg-[#fbfbf8] p-1">
          <button onClick={() => changeFeed("all")} className={`flex h-full items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold ${activeFilter === "all" ? "bg-[#29372b] text-white" : "text-[#858c82] hover:bg-[#f0f1eb]"}`}>
            <Check size={14} />
            {t.all}
          </button>
          <button onClick={() => changeFeed("following")} className={`flex h-full items-center gap-1.5 rounded-md px-3 text-[11px] ${activeFilter === "following" ? "bg-[#29372b] font-semibold text-white" : "text-[#858c82] hover:bg-[#f0f1eb]"}`}>
            {t.following}
          </button>
          <button onClick={() => changeFeed("trending")} className={`flex h-full items-center gap-1.5 rounded-md px-3 text-[11px] ${activeFilter === "trending" ? "bg-[#29372b] font-semibold text-white" : "text-[#858c82] hover:bg-[#f0f1eb]"}`}>
            {t.trending}
          </button>
        </div>
        <QuestionComposer />
        <div className="space-y-4">
          <button
            onClick={() => setCompose(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-[#e5e7df] bg-[#fbfbf8] px-5 py-4 text-left shadow-[0_2px_8px_#21251a08] hover:bg-[#fafbf7] sm:hidden"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f1d8c7] text-[11px] font-bold text-[#624331]">
              A
            </span>
            <span className="flex-1 text-[12px] text-[#9aa096]">
              {t.shareWorking}
            </span>
            <Plus size={17} className="text-[#687660]" />
          </button>
          {posts.map((post) => (
            <FeedCard
              key={post._id}
              post={post}
              currentUserId={currentUserId}
              currentUserReputation={Number(user?.reputation) || 0}
              currentUserRole={user?.role}
              followed={followedUserIds.has(String(post.author?._id))}
              onFollowChange={updateFollowedUser}
              onPostChange={(postId, updatedPost) => {
                setPosts((items) => updatedPost
                  ? items.map((item) => item._id === postId ? { ...item, ...updatedPost } : item)
                  : items.filter((item) => item._id !== postId));
              }}
              onHashtagSelect={(tagName) => changeFeed(activeFilter, tagName)}
              selectedHashtag={hashtag.replace(/^#/, "").toLowerCase()}
            />
          ))}
          {!posts.length && !loading && (
            <div className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] px-5 py-12 text-center text-[11px] text-[#9da39a]">
              {following ? t.followBuilders : t.noPosts}
            </div>
          )}
          {loading && (
            <div className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] p-4" aria-label={t.loadingPosts}>
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="mb-4 h-40 animate-pulse rounded-lg bg-gray-200 last:mb-0"
                />
              ))}
            </div>
          )}
          <div ref={marker} className="h-1" />
          {!hasMore && (
            <div className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] px-5 py-5 text-center text-[11px] text-[#a0a69d]">
              {t.caughtUp}
            </div>
          )}
        </div>
      </section>
      <aside className="hidden space-y-5 xl:block">
        <div className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold">{t.trendingNow}</h2>
            <Link
              href="/feed?sort=trending"
              className="text-[10px] font-medium text-[#708b4e]"
            >
              {t.seeAll}
            </Link>
          </div>
          <div className="space-y-4">
            {trendingTagsError ? (
              <p role="alert" className="text-[10px] text-[#994b36]">
                {trendingTagsError}
              </p>
            ) : trendingTags === null ? (
              <p className="text-[10px] text-[#9da39a]">{t.pleaseWait}</p>
            ) : trendingTags.length ? (
              trendingTags.map(({ tag, postCount }, index) => (
                <Link
                  href={`/feed?tag=${encodeURIComponent(tag)}`}
                  key={tag}
                  className="flex items-start gap-3"
                >
                  <span className="pt-0.5 font-mono text-[10px] text-[#b4b9b0]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block text-[12px] font-semibold text-[#556b3c]">
                      #{tag}
                    </span>
                    <span className="mt-1 block text-[10px] text-[#9da39a]">
                      {postCount} {t.conversations}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-[10px] text-[#9da39a]">{t.noPosts}</p>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-[#e9eee0] p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#d3e2bd] text-[#546e3e]">
              <UsersIcon />
            </span>
            <h2 className="text-[12px] font-semibold">{t.peopleToKnow}</h2>
          </div>
          <div className="mt-4 space-y-3">
            {suggestions.map((person, index) => (
              <div key={person._id} className="flex items-center gap-2.5">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-[9px] font-bold ${avatarColors[index + 1]}`}
                >
                  {person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">
                    {person.name}
                  </span>
                  <span className="block text-[10px] text-[#8b9384]">
                    {person.location || `${person.reputation} ${t.reputation}`}
                  </span>
                </span>
                <button
                  aria-label={`${t("follow")} ${person.name}`}
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/feed/interactions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "follow", userId: person._id }),
                      });
                      if (response.ok) {
                        setSuggestions((items) => {
                          const next = items.filter((item) => item._id !== person._id);
                          writeClientCache(suggestionsCacheKey, next);
                          return next;
                        });
                      } else {
                        const data = await response.json().catch(() => ({}));
                        console.error("Suggested follow failed", { status: response.status, error: data.error });
                        window.alert(response.status === 401 ? t.signInToAction : t.actionFailed);
                      }
                    } catch (error) {
                      console.error("Suggested follow failed", error);
                      window.alert(t.networkError);
                    }
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md border border-[#ccd4c0] text-[#61784a] hover:bg-white"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
            {!suggestions.length && <p className="text-[10px] text-[#8b9384]">{t.meetCommunity}</p>}
          </div>
          <Link
            href="/feed?view=people"
            className="mt-4 block border-t border-[#d8dfcf] pt-3 text-center text-[10px] font-medium text-[#627b49]"
          >
            {t.meetCommunity}{" "}
            <ArrowUpRight size={12} className="ml-1 inline" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-[#a2a79f]">
          <Link href="/about">{t("about")}</Link>
          <Link href="/guidelines">{t("guidelines")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
          <span>{t("ui.copyright")}</span>
        </div>
      </aside>
      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152019]/35 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={createPost}
            className="w-full max-w-[580px] rounded-2xl border border-[#e1e4da] bg-[#fbfbf8] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold">
                  {t.startConversation}
                </h2>
                <p className="mt-1 text-[11px] text-[#8f968d]">
                  {t.shareWork}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompose(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-[#848b82] hover:bg-[#eff0eb]"
                aria-label={t.close}
              >
                <X size={17} />
              </button>
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-5 h-10 w-full rounded-lg border border-[#e4e6de] bg-white px-3 text-[12px] outline-none focus:border-[#91ad71]"
            >
              {[
                "technical update",
                "image",
                "code snippet",
                "project showcase",
                "learning achievement",
              ].map((option) => (
                <option key={option} value={option}>{t.postTypes[option]}</option>
              ))}
            </select>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              maxLength={5000}
              rows={5}
              placeholder={t.contentPlaceholder}
              className="mt-3 w-full resize-y rounded-lg border border-[#e4e6de] bg-white p-3 text-[13px] leading-relaxed outline-none focus:border-[#91ad71]"
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e4e6de] bg-white px-3 text-[11px] text-[#7d857b]">
                <ImageIcon size={15} />
                <input type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0])} className="min-w-0 flex-1 text-[10px]" aria-label={t.uploadImage} />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e4e6de] bg-white px-3 text-[11px] text-[#7d857b]">
                <Code2 size={15} />
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t.codePlaceholder}
                  className="min-w-0 flex-1 outline-none"
                />
              </label>
            </div>
            {uploading && <p className="mt-2 text-[10px] text-[#7a875f]">{t.uploadingImage}</p>}
            {imageUrl && <p className="mt-2 truncate text-[10px] text-[#638047]">{t.imageReady}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompose(false)}
                className="h-9 rounded-lg px-4 text-[11px] text-[#7c847b] hover:bg-[#f0f1eb]"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="h-9 rounded-lg bg-[#293b29] px-4 text-[11px] font-semibold text-white hover:bg-[#3b5738]"
              >
                {t.publishPost}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function UsersIcon() {
  return <span className="text-sm">◎</span>;
}
