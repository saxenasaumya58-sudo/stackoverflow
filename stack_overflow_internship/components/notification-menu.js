"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";

export default function NotificationMenu() {
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const labels = {
    like: t.notificationLike,
    comment: t.notificationComment,
    mention: t.notificationMention,
    follow: t.notificationFollow,
  };
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active) setUnreadCount(data.unreadCount || 0);
      })
      .catch((caughtError) => {
        console.error("Unread notification count failed to load", caughtError);
      });
    return () => {
      active = false;
    };
  }, []);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Notification load failed", { status: response.status, error: data.error });
        setError(translateServerMessage(response.status, { requestFailed, serverError }));
      } else {
        setItems(data.notifications);
        setUnreadCount(data.unreadCount || 0);
        setError("");
      }
    } catch (caughtError) {
      console.error("Notification load failed", caughtError);
      setError(networkError);
    }
  }
  async function markAllRead() {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (response.ok) {
      setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    }
  }
  return (
    <div className="relative ml-2">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-lg text-[#7f867d] hover:bg-[#eceee7]" aria-label={t("notifications")} aria-expanded={open}>
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#ef7957] px-1 text-center text-[9px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && <section className="absolute right-0 top-11 z-40 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#e3e5de] bg-[#fbfbf8] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e8e9e2] px-4 py-3"><div><h2 className="text-[12px] font-semibold">{t.notifications}</h2><p className="mt-0.5 text-[9px] text-[#969d94]">{t.notificationSummary}</p></div><button onClick={markAllRead} aria-label={t.markAllRead} className="grid h-8 w-8 place-items-center rounded-md text-[#75836a] hover:bg-[#edf1e7]"><CheckCheck size={15} /></button></div>
        <div className="max-h-[360px] overflow-y-auto">{error ? <p className="px-4 py-8 text-center text-[11px] text-[#858d83]">{error}</p> : items.map((item) => <a key={item._id} href={item.post ? `/feed#${item.post._id}` : "/feed"} onClick={() => setOpen(false)} className={`block border-b border-[#eff0eb] px-4 py-3 hover:bg-[#f4f5ef] ${item.readAt ? "" : "bg-[#f5f9ef]"}`}><p className="text-[11px] leading-relaxed"><span className="font-semibold">{item.actor?.name || t.communityMember}</span> {labels[item.type] || t.notificationFallback}</p>{item.post?.content && <p className="mt-1 line-clamp-2 text-[10px] text-[#818980]">{item.post.content}</p>}<time className="mt-1 block text-[9px] text-[#a1a79f]">{new Date(item.createdAt).toLocaleString()}</time></a>)}{!error && !items.length && <p className="px-4 py-9 text-center text-[11px] text-[#9ca299]">{t.allCaughtUp}</p>}</div>
      </section>}
    </div>
  );
}