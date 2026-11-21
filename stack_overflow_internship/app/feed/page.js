"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getCachedFeed, refreshFeed } from "@/lib/feed-data";
import PlatformShell from "@/components/platform-shell";
import { useLanguage } from "@/components/language-provider";
import FeedClient from "@/components/feed-client";

function FeedLoading() {
  const { t } = useLanguage();
  return (
    <PlatformShell>
      <div aria-label={t("loadingPosts")} className="mx-auto max-w-[760px]" data-loading-indicator="skeleton">
        {[0, 1, 2].map((item) => (
          <div key={item} className="mb-4 h-40 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    </PlatformShell>
  );
}

function FeedPageContent() {
  const searchParams = useSearchParams();
  const [page] = useState(() => {
    const value = Number(searchParams.get("page") || 1);
    return Number.isInteger(value) && value > 0 ? value : 1;
  });
  const [limit] = useState(() => {
    const value = Number(searchParams.get("limit") || 10);
    return Number.isSafeInteger(value) && value > 0 ? Math.min(10, value) : 10;
  });
  const [sort] = useState(() => searchParams.get("sort") || "");
  const [hashtag] = useState(() => searchParams.get("hashtag") || searchParams.get("tag") || "");
  const [filter] = useState(() => {
    return searchParams.get("filter") ||
      (searchParams.get("following") === "true"
        ? "following"
        : searchParams.get("sort") === "trending"
          ? "trending"
          : "all");
  });
  const query = useMemo(
    () => ({ page, limit, filter, hashtag, sort }),
    [page, limit, filter, hashtag, sort],
  );
  const [initial, setInitial] = useState(() => getCachedFeed(query));

  useEffect(() => {
    let active = true;
    refreshFeed(query)
      .then((data) => {
        if (active) setInitial(data);
      })
      .catch((error) => {
        console.error("Feed loading failed", error);
        if (active && !getCachedFeed(query))
          setInitial({ posts: [], hasMore: false, page: query.page, demo: true });
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <PlatformShell>
      {initial ? (
        <div
          data-scroll-observer="IntersectionObserver"
          data-pagination="infinite"
          data-loading-indicator="none"
          data-filter-field="hashtag"
        >
          <FeedClient
            initial={initial}
            hashtag={hashtag}
            filter={filter}
            sort={sort}
            initialLimit={limit}
          />
        </div>
      ) : <FeedLoadingContent />}
    </PlatformShell>
  );
}

function FeedLoadingContent() {
  const { t } = useLanguage();
  return (
    <div aria-label={t("loadingPosts")} className="mx-auto max-w-[760px]" data-loading-indicator="skeleton">
      {[0, 1, 2].map((item) => (
        <div key={item} className="mb-4 h-40 animate-pulse rounded-lg bg-gray-200" />
      ))}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedPageContent />
    </Suspense>
  );
}