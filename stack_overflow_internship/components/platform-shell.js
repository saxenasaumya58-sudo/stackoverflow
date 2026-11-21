"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  CreditCard,
  Flame,
  Globe2,
  Home,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import NotificationMenu from "@/components/notification-menu";
import { notifyServerLogout } from "@/lib/client-auth";

const primary = [
  ["feed", "/feed", Home],
  ["questions", "/questions", MessageSquareText],
  ["discover", "/discover", Compass],
  ["people", "/people", Users],
];
const account = [
  ["subscription", "/subscription", Sparkles],
  ["billingMembership", "/dashboard/subscription", CreditCard],
  ["security", "/security/devices", Shield],
  ["language", "/settings/language", Globe2],
];

const NavLink = memo(function NavLink({ item, active, onClick, label }) {
  const [, href, Icon] = item;
  return (
    <Link
      onClick={onClick}
      href={href}
      prefetch={true}
      className={`group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] transition ${active ? "bg-[#e9f0de] font-semibold text-[#263d22]" : "text-[#6f756f] hover:bg-[#f0f1eb] hover:text-[#202521]"}`}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {item[0] === "discover" && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ed7955]" />
      )}
    </Link>
  );
});

export default function PlatformShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, user, setUser, authLoaded } = useLanguage();
  const close = useCallback(() => setMobileOpen(false), []);
  const displayName = user?.name?.trim();
  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : user?.email?.trim()?.[0]?.toUpperCase() || "";
  const routeLabels = {
    feed: t.feed,
    questions: t.questions,
    discover: t.discover,
    people: t.people,
    language: t.language,
    billing: t.billing,
    subscription: t.subscription,
    devices: t.security,
    reports: t.moderation,
    gold: t.membership,
    search: t.search,
    me: t.myProfile,
    profile: t("profile"),
    forgotPassword: t.forgotPassword,
  };
  const routeName =
    pathname.startsWith("/profile/")
      ? "profile"
      : pathname === "/forgot-password"
        ? "forgotPassword"
        : pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ||
          "home";

  function logout() {
    setUser(null);
    router.replace("/login");
    notifyServerLogout();
  }

  const nav = (
    <>
      <div className="flex h-[72px] items-center gap-2.5 border-b border-[#e9eae4] px-6">
        <span className="grid h-8 w-8 rotate-[-8deg] place-items-center rounded-[11px] bg-[#c7f36b] text-[#26381c]">
          <Sparkles size={17} fill="currentColor" />
        </span>
        <span className="text-[19px] font-bold tracking-[-.6px]">
          commons<span className="text-[#80aa43]">.</span>
        </span>
        <span className="ml-auto rounded-full border border-[#e3e5dd] px-2 py-1 text-[9px] font-bold uppercase tracking-[1px] text-[#899087]">
          {t("ui.betaLabel")}
        </span>
      </div>
      <div className="px-4 pt-7">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[1.2px] text-[#9da199]">
          {t.workspace}
        </p>
        <nav className="space-y-1">
          {primary.map((item) => (
            <NavLink
              key={item[0]}
              item={item}
              label={t(item[0])}
              active={pathname === item[1] || pathname.startsWith(`${item[1]}/`)}
              onClick={close}
            />
          ))}
        </nav>
        <div className="mb-2 mt-8 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#9da199]">
            {t.yourSpace}
          </p>
          <button
            aria-label={t.createPost}
            className="grid h-6 w-6 place-items-center rounded-md text-[#868c83] hover:bg-[#eff0e9]"
          >
            <Plus size={15} />
          </button>
        </div>
        <Link
          href="/profile/me"
          onClick={close}
          className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13px] text-[#6f756f] hover:bg-[#f0f1eb]"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f4d9c9] text-[10px] font-bold text-[#6d4734]">
            {initials}
          </span>
          {t.myProfile}
        </Link>
        <div className="mb-2 mt-8 px-3">
          <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#9da199]">
            {t.account}
          </p>
        </div>
        <nav className="space-y-1">
          {account.map((item) => (
            <NavLink
              key={item[0]}
              item={item}
              label={t(item[0])}
              active={pathname.startsWith(item[1])}
              onClick={close}
            />
          ))}
          {user?.role === "admin" && (
            <>
              <NavLink
                item={["adminReports", "/admin/reports", Shield]}
                label={t.moderation}
                active={pathname.startsWith("/admin/reports")}
                onClick={close}
              />
              <NavLink
                item={["adminSecurity", "/admin/security", Shield]}
                label={t.loginActivity}
                active={pathname.startsWith("/admin/security")}
                onClick={close}
              />
            </>
          )}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-xl bg-[#1f2923] p-4 text-white">
          <div className="mb-3 flex items-center gap-1.5 text-[#c7f36b]">
            <Flame size={14} />
            <span className="text-[10px] font-bold uppercase tracking-[1px]">
              {t.weeklyPulse}
            </span>
          </div>
          <p className="text-[13px] font-semibold">{t.keepMomentum}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            {t.streakMessage}
          </p>
          <div className="mt-4 flex gap-1.5">
            {[1, 1, 1, 0, 0, 0, 0].map((on, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full ${on ? "bg-[#c7f36b]" : "bg-white/15"}`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-4 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-xs text-[#858b82] hover:bg-[#eff0e9]"
        >
          <LogOut size={15} />
          {t.signOut}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#191d1b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-[#e7e8e1] bg-[#fafaf7] lg:flex">
        {nav}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label={t("closeMenu")}
            onClick={close}
            className="absolute inset-0 bg-black/30"
          />
          <aside className="relative flex h-full w-[270px] flex-col bg-[#fafaf7] shadow-2xl">
            {nav}
            <button
              onClick={close}
              className="absolute right-3 top-5 grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"
              aria-label={t.closeMenu}
            >
              <X size={18} />
            </button>
          </aside>
        </div>
      )}
      <div className="lg:pl-[244px]">
        <header className="flex h-[66px] items-center border-b border-[#e7e8e1]/80 bg-[#f8f8f4] px-4 sm:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 grid h-9 w-9 place-items-center rounded-lg hover:bg-[#eceee7] lg:hidden"
            aria-label={t.openMenu}
          >
            <Menu size={19} />
          </button>
          <div className="hidden items-center gap-2 text-[11px] text-[#969c93] sm:flex">
            <span>{t.community}</span>
            <span className="text-[#c3c6be]">/</span>
            <span className="font-medium capitalize text-[#596159]">
              {pathname
                ? routeLabels[routeName] || t(routeName)
                : t.home}
            </span>
          </div>
          <button className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-[#e6e7e0] bg-white/70 px-3 text-[11px] text-[#8a9087] hover:border-[#cbd0c3]">
            <span className="hidden sm:inline">{t.searchAnything}</span>
            <span className="sm:hidden">{t.search}</span>
            <kbd className="rounded border border-[#ebebe6] bg-[#f7f7f4] px-1.5 py-0.5 text-[9px]">
              ⌘ K
            </kbd>
          </button>
          <LanguageSwitcher compact />
          <NotificationMenu />
          {authLoaded &&
            (user ? (
              <button
                onClick={logout}
                className="ml-2 inline-flex h-9 items-center gap-2 rounded-lg border border-[#e6e7e0] bg-white/70 px-3 text-[11px] font-medium text-[#596159] hover:border-[#cbd0c3]"
              >
                <LogOut size={14} />
                {t.logout}
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-2 inline-flex h-9 items-center gap-2 rounded-lg border border-[#e6e7e0] bg-white/70 px-3 text-[11px] font-medium text-[#596159] hover:border-[#cbd0c3]"
              >
                <LogIn size={14} />
                {t.login}
              </Link>
            ))}
          {user && (
            <Link
              href="/profile/me"
              aria-label={displayName || user.email || t.myProfile}
              className="ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#f1d8c7] text-[11px] font-bold text-[#624331] shadow-sm"
            >
              {initials}
            </Link>
          )}
        </header>
        <main className="mx-auto min-h-[calc(100vh-66px)] max-w-[1330px] px-4 py-7 sm:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
