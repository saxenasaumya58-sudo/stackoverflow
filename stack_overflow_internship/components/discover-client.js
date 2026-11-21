"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, Hash, MessageCircle, ThumbsUp } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";
import { fetchClientCache, readClientCache } from "@/lib/client-cache";

export default function DiscoverClient() {
  const { language, t, user } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const cacheKey = `discover:${user?.id || "guest"}`;
  const [cached] = useState(() => readClientCache(cacheKey));
  const [posts, setPosts] = useState(cached?.posts || []);
  const [tags, setTags] = useState(cached?.trendingTags || []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    const hadCache = Boolean(readClientCache(cacheKey));
    fetchClientCache(
      cacheKey,
      async () => {
        const response = await fetch(
          "/api/feed?sort=trending&page=1&limit=12&includeTags=true",
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            translateServerMessage(response.status, { requestFailed, serverError }),
          );
        }
        return {
          posts: result.posts || [],
          trendingTags: result.trendingTags || [],
        };
      },
      { revalidate: hadCache },
    )
      .then((result) => {
        if (!active) return;
        setPosts(result.posts);
        setTags(result.trendingTags);
        setError("");
      })
      .catch((requestError) => {
        console.error("Discover data failed to load", requestError);
        if (active) setError(hadCache ? "" : networkError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cacheKey, networkError, requestFailed, serverError]);

  return (
    <div className="page-enter mx-auto max-w-[1120px]">
      <header className="mb-7">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]"><Flame size={13} />{t("discover")}</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">{t("discover.title")}</h1>
        <p className="mt-1 text-[12px] text-[#8c938b]">{t("discoverIntro")}</p>
      </header>
      <section aria-labelledby="trending-tags" className="mb-7">
        <div className="mb-3 flex items-center gap-2"><Hash size={15} className="text-[#718c50]" /><h2 id="trending-tags" className="text-[13px] font-semibold">{t("trendingTags")}</h2></div>
        {error && <p role="alert" className="rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {tags.map((item, index) => <Link key={item.tag} href={`/feed?tag=${encodeURIComponent(item.tag)}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#e2e6dc] bg-[#fbfbf8] px-3 text-[11px] transition hover:border-[#bdcda9] hover:bg-[#f7faf2]"><span className="font-semibold text-[#5e7a43]">#{item.tag}</span><span className="text-[9px] text-[#9aa197]">{item.postCount} {t.postCountLabel}</span>{index < 3 && <span className="h-1.5 w-1.5 rounded-full bg-[#ed895e]" />}</Link>)}
          {!loading && !tags.length && !error && <p className="text-[11px] text-[#9ca299]">{t.tagsTrendHint}</p>}
        </div>
      </section>
      <section aria-labelledby="trending-posts">
        <div className="mb-3 flex items-center justify-between"><div><h2 id="trending-posts" className="text-[13px] font-semibold">{t("discover.trending")}</h2><p className="mt-1 text-[10px] text-[#969d94]">{t("engagementRank")}</p></div><Link href="/feed?sort=trending" className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6a844b]">{t("discover.search")}<ArrowUpRight size={13} /></Link></div>
        <div className="overflow-hidden rounded-xl border border-[#e5e7df] bg-[#fbfbf8]">
          {posts.map((post, index) => <article key={post._id} className="flex gap-4 border-b border-[#e8e9e2] px-4 py-4 last:border-0 sm:px-5"><span className="w-7 shrink-0 pt-1 font-mono text-[11px] text-[#a8aea4]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 text-[10px] text-[#92998f]"><span className="font-semibold text-[#444e43]">{post.author?.name || t.communityMember}</span><span>·</span><span>{t.postTypes?.[post.type] || post.type}</span><span>·</span><span>{new Date(post.createdAt).toLocaleDateString(language)}</span></div><Link href={`/feed#${post._id}`} className="mt-2 block text-[12px] leading-relaxed text-[#384139] hover:text-[#5e7a43]">{post.content}</Link><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-[#92998f]"><span className="inline-flex items-center gap-1"><ThumbsUp size={12} />{post.likes || 0}</span><span className="inline-flex items-center gap-1"><MessageCircle size={12} />{post.comments || 0}</span>{post.hashtags?.map((tag) => <Link key={tag} href={`/feed?tag=${encodeURIComponent(tag)}`} className="text-[#668348]">#{tag}</Link>)}</div></div></article>)}
          {loading && <div className="space-y-3 p-5"><div className="skeleton h-4 w-1/3 rounded" /><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>}
          {!loading && !posts.length && !error && <p className="px-5 py-12 text-center text-[11px] text-[#9ca299]">{t.noTrendingPosts}</p>}
        </div>
      </section>
    </div>
  );
}
