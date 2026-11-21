import {
  fetchClientCache,
  readClientCache,
} from "@/lib/client-cache";

function feedKey({ page = 1, limit = 10, filter = "all", hashtag = "", sort = "" }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    filter,
  });
  if (sort || filter === "trending") params.set("sort", sort || "trending");
  if (hashtag) params.set("hashtag", hashtag.replace(/^#/, ""));
  return `/api/feed?${params}`;
}

async function fetchFeed(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load the feed.");
  return data;
}

export async function getFeed({ page = 1, limit = 10, filter = "all", hashtag = "", sort = "" }) {
  const url = feedKey({ page, limit, filter, hashtag, sort });
  return fetchClientCache(url, () => fetchFeed(url));
}

export function getCachedFeed(options) {
  return readClientCache(feedKey(options));
}

export async function refreshFeed(options) {
  const url = feedKey(options);
  return fetchClientCache(url, () => fetchFeed(url), { revalidate: true });
}

const trendingTagsKey = "feed:trending-tags";

async function fetchTrendingTags() {
  const data = await fetchFeed("/api/feed?includeTags=true&limit=1");
  if (!Array.isArray(data.trendingTags))
    throw new Error("Trending tags were not returned.");
  return data.trendingTags;
}

export function getCachedTrendingTags() {
  return readClientCache(trendingTagsKey);
}

export function getTrendingTags({ revalidate = false } = {}) {
  return fetchClientCache(trendingTagsKey, fetchTrendingTags, { revalidate });
}