"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Users } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";
import { fetchClientCache, readClientCache, writeClientCache } from "@/lib/client-cache";

export default function PeopleClient() {
  const { t, user } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const signInToAction = t.signInToAction;
  const cacheKey = `people:${user?.id || "guest"}`;
  const cached = readClientCache(cacheKey);
  const [users, setUsers] = useState(cached?.users || []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cached);
  const [busyId, setBusyId] = useState("");
  const [hasMore, setHasMore] = useState(Boolean(cached?.hasMore));
  const [nextPage, setNextPage] = useState(cached?.nextPage || 1);
  const loadMoreRef = useRef(null);
  const loadingRef = useRef(false);

  const loadUsers = useCallback(async (page, append = false, revalidate = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!append && !readClientCache(cacheKey)) setLoading(true);
    try {
        const result = await fetchClientCache(
          `${cacheKey}:page:${page}`,
          async () => {
            const response = await fetch(`/api/users?page=${page}`);
            const data = await response.json();
            if (!response.ok) {
              const message = translateServerMessage(response.status, {
                requestFailed,
                serverError,
                signInToAction,
              }, {
                unauthorizedKey: "signInToAction",
              });
              throw new Error(message);
            }
            return data;
          },
          { revalidate },
        );
        setUsers((current) => {
          const currentCache = readClientCache(cacheKey);
          const nextUsers = append
            ? [...current, ...result.users]
            : revalidate && current.length > result.users.length
              ? [...result.users, ...current.slice(result.users.length)]
              : result.users;
          const state = {
            users: nextUsers,
            hasMore: Boolean(result.hasMore),
            nextPage: append ? page + 1 : Math.max(page + 1, currentCache?.nextPage || 1),
          };
          writeClientCache(cacheKey, state);
          return nextUsers;
        });
        setHasMore(Boolean(result.hasMore));
        setNextPage((current) => append ? page + 1 : Math.max(page + 1, current));
        setError("");
      } catch (requestError) {
        if (!readClientCache(cacheKey))
          setError(requestError.message || networkError);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
  }, [cacheKey, networkError, requestFailed, serverError, signInToAction]);

  useEffect(() => {
    loadUsers(1, false, Boolean(readClientCache(cacheKey)));
  }, [cacheKey, loadUsers]);

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadUsers(nextPage, true);
    }, { rootMargin: "200px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadUsers, nextPage]);

  async function toggleFollow(userId) {
    setBusyId(userId);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        return setError(
          translateServerMessage(response.status, {
            requestFailed,
            serverError,
            signInToAction,
          }, {
            unauthorizedKey: "signInToAction",
          }),
        );
      setUsers((current) => {
        const nextUsers = current.map((person) => person._id === userId ? { ...person, following: result.following } : person);
        const currentCache = readClientCache(cacheKey);
        if (currentCache) writeClientCache(cacheKey, { ...currentCache, users: nextUsers });
        return nextUsers;
      });
    } catch {
      setError(networkError);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="page-enter mx-auto max-w-[1050px]">
      <header className="mb-7">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]"><Users size={13} />{t.community}</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">{t.peopleHeadline}</h1>
        <p className="mt-1 text-[12px] text-[#8c938b]">{t.peopleIntro}</p>
      </header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-[#ead9cf] bg-[#fffaf7] p-4 text-[11px] text-[#87513e]">{error}{error === t.signInToAction && <Link href="/login" className="ml-2 font-semibold underline">{t.signIn}</Link>}</div>}
      <div className="overflow-hidden rounded-xl border border-[#e5e7df] bg-[#fbfbf8]">
        {users.map((person, index) => <article key={person._id} className="flex flex-wrap items-center gap-3 border-b border-[#e8e9e2] p-4 last:border-0 sm:px-5"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[11px] font-bold ${["bg-[#f0d4c1] text-[#71482f]", "bg-[#d9e6c2] text-[#405831]", "bg-[#d8e2f4] text-[#43587f]", "bg-[#f2e5ab] text-[#6d5d19]"][index % 4]}`}>{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div className="min-w-0 flex-1"><Link href={`/profile/${person._id}`} className="block truncate text-[12px] font-semibold hover:text-[#5e7a43]">{person.name}</Link><p className="mt-1 truncate text-[10px] text-[#8d958b]">{person.email}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[9px] text-[#9aa197]"><span>{person.reputation} {t.reputation}</span>{person.location && <span className="inline-flex items-center gap-1"><MapPin size={10} />{person.location}</span>}</div></div><button onClick={() => toggleFollow(person._id)} disabled={busyId === person._id} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold transition disabled:opacity-60 ${person.following ? "border border-[#dfe3d8] text-[#737e6d] hover:bg-[#f2f3ed]" : "bg-[#293b29] text-white hover:bg-[#3b5738]"}`}>{busyId === person._id ? t.saving : person.following ? t.following : t.follow}{!person.following && <ArrowUpRight size={12} />}</button></article>)}
        {hasMore && <div ref={loadMoreRef} aria-hidden="true" />}
        {loading && <div className="space-y-4 p-5"><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /><div className="skeleton h-12 rounded-lg" /></div>}
        {!loading && !error && !users.length && <p className="px-5 py-12 text-center text-[11px] text-[#9ca299]">{t.firstMember}</p>}
      </div>
    </div>
  );
}
