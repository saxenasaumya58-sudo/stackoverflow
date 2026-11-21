"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Globe2,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";
import {
  hasReputationPrivilege,
  REPUTATION_AWARDS,
  REPUTATION_PRIVILEGES,
  REPUTATION_TRANSFER_POLICY,
} from "@/lib/reputation-policy.mjs";

function formatPolicyMessage(template, values) {
  return Object.entries(values).reduce(
    (message, [key, value]) =>
      message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const privilegeLabels = [
  ["Comment on community posts", REPUTATION_PRIVILEGES.comment],
  ["Edit community posts", REPUTATION_PRIVILEGES.editCommunityPost],
  ["Vote to close questions", REPUTATION_PRIVILEGES.closeQuestion],
  ["Report inappropriate content", REPUTATION_PRIVILEGES.reportInappropriateContent],
];

export default function ProfilePage({ params }) {
  const { t, setUser, user } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const signInToAction = t.signInToAction;
  const transferWindowHours =
    REPUTATION_TRANSFER_POLICY.rollingWindowMs / (60 * 60 * 1000);
  const transferGuidelines = formatPolicyMessage(
    t.transferGuidelines ||
      "Send {minimumPoints}–{maximumPoints} points per transfer, up to {dailyLimit} in a rolling {windowHours} hours. You need more than {minimumBalance} points to send.",
    {
      minimumPoints: REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction,
      maximumPoints: REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction,
      dailyLimit: REPUTATION_TRANSFER_POLICY.maximumPointsPerRolling24Hours,
      windowHours: transferWindowHours,
      minimumBalance: REPUTATION_TRANSFER_POLICY.minimumBalance,
    },
  );
  const profileBonusNotice = formatPolicyMessage(
    t.profileBonusNotice || "Complete your profile to earn {points} points.",
    { points: REPUTATION_AWARDS.profileComplete },
  );
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [error, setError] = useState("");
  const [transferError, setTransferError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [points, setPoints] = useState(
    REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction,
  );
  const [reason, setReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [draft, setDraft] = useState({ name: "", bio: "", location: "", website: "" });
  const canTransfer =
    Number(profile?.reputation) > REPUTATION_TRANSFER_POLICY.minimumBalance;

  useEffect(() => {
    fetch(`/api/profile/${params.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setProfile({ ...data.user, subscription: data.subscription });
          setDraft({ name: data.user.name || "", bio: data.user.bio || "", location: data.user.location || "", website: data.user.website || "" });
          setLogs(data.reputation);
          fetch(`/api/users/${data.user._id}/follow`)
            .then((followResponse) =>
              followResponse.ok ? followResponse.json() : null,
            )
            .then((counts) => {
              if (!counts) return;
              setFollowing(Boolean(counts.followed));
              setFollowCounts({
                followers: counts.followersCount || 0,
                following: counts.followingCount || 0,
              });
            })
            .catch(() => {});
        } else setError(translateServerMessage(response.status, { requestFailed, serverError }));
      })
      .catch(() => setError(networkError));
    fetch(`/api/reputation/history/${params.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setTransactions(data.transactions || []); })
      .catch(() => {});
  }, [params.id, networkError, requestFailed, serverError]);

  async function transferPoints(event) {
    event.preventDefault();
    setTransferBusy(true);
    setTransferError("");
    try {
      const response = await fetch("/api/reputation/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver: recipient, points: Number(points), reason }),
      });
      if (!response.ok) {
        setTransferError(translateServerMessage(response.status, { requestFailed, serverError, signInToAction }, { unauthorizedKey: "signInToAction" }));
        return;
      }
      setRecipient("");
      setReason("");
      const historyResponse = await fetch(`/api/reputation/history/${params.id}`);
      if (!historyResponse.ok) {
        setTransferError(translateServerMessage(historyResponse.status, { requestFailed, serverError }));
        return;
      }
      const history = await historyResponse.json();
      setTransactions(history.transactions || []);
      setProfile((current) => ({ ...current, reputation: history.reputation }));
    } catch {
      setTransferError(networkError);
    } finally {
      setTransferBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setProfileError("");
    try {
      const response = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setProfileError(translateServerMessage(response.status, { requestFailed, serverError, signInToAction }, { unauthorizedKey: "signInToAction" }));
        return;
      }
      const result = await response.json();
      setProfile((current) => ({ ...current, ...result.user }));
      if (user?.id === result.user.id)
        setUser((current) => ({ ...current, ...result.user }));
      setEditing(false);
    } catch {
      setProfileError(networkError);
    } finally {
      setSaving(false);
    }
  }

  async function follow() {
    try {
      const response = await fetch("/api/feed/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow", userId: profile._id }),
      });
      if (response.ok) {
        const data = await response.json();
        setFollowing(data.following);
        setFollowCounts((current) => ({
          ...current,
          followers: Math.max(
            0,
            current.followers + (data.following ? 1 : -1),
          ),
        }));
      }
      else window.alert(translateServerMessage(response.status, { requestFailed, serverError, signInToAction }, { unauthorizedKey: "signInToAction" }));
    } catch {
      window.alert(networkError);
    }
  }

  if (error) return <p className="page-enter text-[12px] text-[#994b36]">{error}</p>;

  return (
    <div className="page-enter mx-auto max-w-[900px]">
      <section className="overflow-hidden rounded-xl border border-[#e3e6dd] bg-[#fbfbf8]">
        <div className="h-28 bg-[#e7eddc]" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-9 flex items-end justify-between">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl border-4 border-[#fbfbf8] bg-[#f1d8c7] text-[20px] font-bold text-[#624331]">
              {profile?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || ".."}
            </span>
            {params.id === "me" ? (
              <button onClick={() => setEditing(true)} className="h-9 rounded-lg border border-[#dfe2d9] bg-white px-4 text-[11px] font-semibold hover:bg-[#f2f3ed]">{t("profile.edit")}</button>
            ) : (
              <button onClick={follow} className="h-9 rounded-lg border border-[#dfe2d9] bg-white px-4 text-[11px] font-semibold hover:bg-[#f2f3ed]">{following ? t.following : t.follow}</button>
            )}
          </div>
          <h1 className="mt-3 text-[23px] font-semibold">{profile?.name || t.loadingProfile}</h1>
          <p className="mt-1 text-[11px] text-[#969d94]">{profile?.email ? `@${profile.email.split("@")[0]}` : t.communityMember}</p>
          {profile?.subscription?.plan && profile.subscription.plan !== "free" && (
            <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${profile.subscription.plan === "gold" ? "bg-[#f7edc9] text-[#8b6d13]" : profile.subscription.plan === "silver" ? "bg-[#e8ece8] text-[#58645d]" : "bg-[#f4e2d6] text-[#9a5d37]"}`}>
              {profile.subscription.plan === "bronze" && "🥉 "}
              {profile.subscription.plan === "silver" && "🥈 "}
              {profile.subscription.plan === "gold" && "🥇 "}
              {t(`badge.${profile.subscription.plan}`)}
            </span>
          )}
          <p className="mt-3 max-w-[600px] text-[12px] leading-relaxed text-[#606960]">{profile?.bio || t.communityMember}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#90978e]">
            {profile?.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{profile.location}</span>}
            {profile?.website && <a href={profile.website} className="inline-flex items-center gap-1"><Globe2 size={12} />{t.website}</a>}
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{t.joined} {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Commons"}</span>
          </div>
          <div className="mt-5 flex gap-5 border-t border-[#eceee7] pt-4">
            <div><span className="text-[17px] font-semibold">{profile?.reputation ?? "—"}</span><span className="ml-1.5 text-[10px] text-[#989f96]">{t.reputation}</span></div>
            <div><span className="text-[17px] font-semibold">{followCounts.followers}</span><span className="ml-1.5 text-[10px] text-[#989f96]">{t.followers}</span></div>
            <div><span className="text-[17px] font-semibold">{followCounts.following}</span><span className="ml-1.5 text-[10px] text-[#989f96]">{t.following}</span></div>
            <span className="inline-flex items-center gap-1 self-center rounded-full bg-[#edf3e4] px-2 py-1 text-[9px] font-semibold text-[#648047]"><BadgeCheck size={12} />{t.communityBuilder || t.community}</span>
          </div>
        </div>
      </section>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152019]/40 p-4">
          <form onSubmit={saveProfile} className="w-full max-w-[520px] rounded-2xl border border-[#e2e5db] bg-[#fbfbf8] p-6 shadow-2xl">
            <h2 className="text-[17px] font-semibold">{t("profile.edit")}</h2>
            <p className="mt-1 text-[11px] text-[#8c9389]">{profileBonusNotice}</p>
            <div className="mt-5 space-y-3">
              <input required minLength={2} maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t.name} className="h-10 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[12px] outline-none focus:border-[#91ad71]" />
              <textarea required maxLength={500} rows={3} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder={t.bio} className="w-full rounded-lg border border-[#e1e4db] bg-white p-3 text-[12px] outline-none focus:border-[#91ad71]" />
              <input required value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder={t.location} className="h-10 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[12px] outline-none focus:border-[#91ad71]" />
              <input type="url" value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} placeholder={`https:// (${t.optional})`} className="h-10 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[12px] outline-none focus:border-[#91ad71]" />
            </div>
            {profileError && <p role="alert" className="mt-3 text-[11px] text-[#994b36]">{profileError}</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg px-3 text-[11px] text-[#727a70]">{t.cancel}</button><button disabled={saving} className="h-9 rounded-lg bg-[#293b29] px-4 text-[11px] font-semibold text-white">{saving ? t.saving : t.saveProfile}</button></div>
          </form>
        </div>
      )}
      <section className="mt-6 overflow-hidden rounded-xl border border-[#e3e6dd] bg-[#fbfbf8]">
        <div className="flex items-center gap-2 border-b border-[#e8e9e2] px-5 py-4"><Sparkles size={15} className="text-[#79934e]" /><div><h2 className="text-[12px] font-semibold">{t.profileHistory}</h2><p className="mt-1 text-[10px] text-[#969d94]">{t.historyIntro}</p></div></div>
        {logs.map((log) => (
          <div key={log._id} className="flex items-center gap-3 border-b border-[#eff0eb] px-5 py-3 last:border-0">
            <span className={`grid h-7 w-7 place-items-center rounded-full ${log.points > 0 ? "bg-[#eaf1e0] text-[#668348]" : "bg-[#f8eae4] text-[#a35e45]"}`}>{log.points > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-medium">{log.reason}</span><span className="mt-1 block text-[9px] text-[#a2a89f]">{new Date(log.createdAt).toLocaleString()}{log.relatedId && <> · <code>{String(log.relatedId)}</code></>}</span></span>
            <span className={`text-[12px] font-semibold ${log.points > 0 ? "text-[#668348]" : "text-[#a35e45]"}`}>{log.points > 0 ? "+" : ""}{log.points}</span>
          </div>
        ))}
        {!logs.length && <div className="px-5 py-10 text-center text-[10px] text-[#9da39a]">{profile ? t.reputationEmpty : t.loadingProfile}</div>}
      </section>
      <section className="mt-6 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
        <h2 className="text-[13px] font-semibold">Community privileges</h2>
        <ul className="mt-3 space-y-2">
          {privilegeLabels.map(([label, threshold]) => {
            const unlocked =
              (params.id === "me" && user?.role === "admin") ||
              hasReputationPrivilege(profile?.reputation, threshold);
            return (
              <li key={label} className="flex items-center justify-between gap-3 text-[11px]">
                <span>{label}</span>
                <span className={unlocked ? "font-semibold text-[#527936]" : "text-[#92988e]"}>
                  {unlocked ? "Unlocked" : `${threshold} reputation required`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      {params.id === "me" && (
        <section className="mt-6 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold">{t.shareReputation}</h2>
            <p className="mt-1 text-[10px] text-[#939a91]">{transferGuidelines}</p>
            <form onSubmit={transferPoints} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_minmax(0,1.3fr)_auto]">
              <input type="email" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={t.memberEmail} className="h-10 min-w-0 rounded-lg border border-[#e1e4db] bg-white px-3 text-[11px] outline-none focus:border-[#91ad71]" />
              <input type="number" required min={REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction} max={REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction} value={points} onChange={(event) => setPoints(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#e1e4db] bg-white px-3 text-[11px] outline-none focus:border-[#91ad71]" aria-label={t.reputation} />
              <input required maxLength="250" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t.transferReason} className="h-10 min-w-0 rounded-lg border border-[#e1e4db] bg-white px-3 text-[11px] outline-none focus:border-[#91ad71]" />
              <button disabled={transferBusy || !canTransfer} className="h-10 rounded-lg bg-[#293b29] px-4 text-[10px] font-semibold text-white disabled:opacity-60">{transferBusy ? t.sending : t.transfer}</button>
            </form>
            {transferError && <p role="alert" className="mt-3 text-[10px] text-[#994b36]">{transferError}</p>}
        </section>
      )}
      <section className="mt-5 overflow-hidden rounded-xl border border-[#e3e6dd] bg-[#fbfbf8]">
            <div className="border-b border-[#e8e9e2] px-5 py-4"><h2 className="text-[12px] font-semibold">{t.transferHistory}</h2><p className="mt-1 text-[10px] text-[#969d94]">{t.transferHistoryIntro}</p></div>
            {transactions.map((transaction) => {
              const sent = String(transaction.sender?._id) === String(profile?._id);
              const status = transaction.status || "completed";
              return <div key={transaction._id} className="flex items-center gap-3 border-b border-[#eff0eb] px-5 py-3 last:border-0"><span className={`grid h-7 w-7 place-items-center rounded-full ${sent ? "bg-[#f8eae4] text-[#a35e45]" : "bg-[#eaf1e0] text-[#668348]"}`}>{sent ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}</span><span className="min-w-0 flex-1"><span className="block text-[11px] font-medium">{sent ? `${t.toLabel} ${transaction.receiver?.name || t.member}` : `${t.fromLabel} ${transaction.sender?.name || t.member}`}</span><span className="mt-1 block text-[9px] text-[#a2a89f]">{transaction.reason} · {new Date(transaction.createdAt).toLocaleString()} · {t.transferStatus[status] || status}</span></span><span className={`text-[12px] font-semibold ${sent ? "text-[#a35e45]" : "text-[#668348]"}`}>{sent ? "−" : "+"}{transaction.points}</span></div>;
            })}
            {!transactions.length && <div className="px-5 py-9 text-center text-[10px] text-[#9da39a]">{t.transferEmpty}</div>}
      </section>
    </div>
  );
}
