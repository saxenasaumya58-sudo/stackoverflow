"use client";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";

async function fetchSearchResults(search, type, since, tag, votes) {
  const params = new URLSearchParams({
    q: search,
    ...(type ? { type } : {}),
    ...(since ? { since } : {}),
    ...(tag ? { tag } : {}),
    ...(votes ? { votes } : {}),
  });
  const response = await fetch(`/api/search?${params}`);
  return { response, data: await response.json() };
}

export default function SearchResults({ initialQuery = "" }) {
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState("");
  const [since, setSince] = useState("");
  const [tag, setTag] = useState("");
  const [votes, setVotes] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchSearchResults(initialQuery, "", "")
      .then(({ response, data }) => {
        if (response.ok) {
          setResults(data.posts);
          setAdvanced(data.advancedSearch);
        } else {
          console.error("Initial search failed", { status: response.status, error: data.error });
          setError(translateServerMessage(response.status, { requestFailed, serverError }));
        }
      })
      .catch((caughtError) => {
        console.error("Initial search failed", caughtError);
        setError(networkError);
      });
  }, [initialQuery, networkError, requestFailed, serverError]);
  async function runSearch(search = query) {
    setBusy(true);
    setError("");
    try {
      const { response, data } = await fetchSearchResults(search, type, since, tag, votes);
      if (!response.ok) {
        console.error("Search request failed", { status: response.status, error: data.error });
        return setError(translateServerMessage(response.status, { requestFailed, serverError }));
      }
      setResults(data.posts);
      setAdvanced(data.advancedSearch);
    } catch (caughtError) {
      console.error("Search request failed", caughtError);
      setError(networkError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter mx-auto max-w-[900px]">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">
          {t.exploreCommunity}
        </p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">
          {t.searchCommunity}
        </h1>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        className="flex gap-2"
      >
        <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-[#e1e4db] bg-[#fbfbf8] px-3">
          <Search size={16} className="text-[#90988d]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
          />
        </label>
        <button className="h-11 rounded-lg bg-[#293b29] px-4 text-[11px] font-semibold text-white">
          {t.search}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#e5e7df] bg-[#fbfbf8] p-3">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] text-[#858d83]">
          <SlidersHorizontal size={13} />
          {t.filters}
        </span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          disabled={!advanced}
          className="h-8 rounded-md border border-[#e5e7df] bg-white px-2 text-[10px]"
        >
          <option value="">{t.allPostTypes}</option>
          {[
            "technical update",
            "image",
            "code snippet",
            "project showcase",
            "learning achievement",
          ].map((item) => (
            <option key={item} value={item}>{t.postTypes[item]}</option>
          ))}
        </select>
        <input
          type="date"
          value={since}
          onChange={(event) => setSince(event.target.value)}
          disabled={!advanced}
          className="h-8 rounded-md border border-[#e5e7df] bg-white px-2 text-[10px]"
        />
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          placeholder={t("tagFilter")}
          disabled={!advanced}
          className="h-8 w-24 rounded-md border border-[#e5e7df] bg-white px-2 text-[10px] disabled:opacity-50"
        />
        <input
          type="number"
          min="1"
          value={votes}
          onChange={(event) => setVotes(event.target.value)}
          placeholder={t("minimumVotes")}
          disabled={!advanced}
          className="h-8 w-24 rounded-md border border-[#e5e7df] bg-white px-2 text-[10px] disabled:opacity-50"
        />
        <span className="ml-auto text-[9px] text-[#9ba198]">
          {advanced ? t.advancedFiltersEnabled : t.basicSearch}
        </span>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-2">
        {busy ? (
          <div className="skeleton h-28 rounded-xl" />
        ) : (
          results.map((post) => (
            <article
              key={post._id}
              className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] p-4"
            >
              <p className="text-[13px] font-semibold">
                {post.author?.name || t.communityMember} · {post.type === "question" ? t.questions : t.postTypes[post.type] || post.type}
              </p>
              <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[#626a61]">
                {post.content}
              </p>
              <div className="mt-2 flex gap-2">
                {post.hashtags?.map((tag) => (
                  <a
                    key={tag}
                    href={`/feed?tag=${tag}`}
                    className="text-[10px] text-[#668348]"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </article>
          ))
        )}
        {!busy && !results.length && (
          <div className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] py-12 text-center text-[11px] text-[#9da39a]">
            {t.noPostsMatch}
          </div>
        )}
      </div>
    </div>
  );
}
