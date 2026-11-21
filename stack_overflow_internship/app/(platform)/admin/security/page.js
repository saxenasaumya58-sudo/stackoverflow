"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";

async function fetchLoginPage(page) {
  const response = await fetch(`/api/admin/security?page=${page}&limit=25`);
  return { response, data: await response.json() };
}

export default function AdminSecurityPage() {
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inactivityMinutes, setInactivityMinutes] = useState(null);

  async function loadPage(nextPage) {
    setLoading(true);
    try {
      const { response, data } = await fetchLoginPage(nextPage);
      if (!response.ok) {
        setError(translateServerMessage(response.status, { requestFailed, serverError }));
        return;
      }
      setLogs((items) => nextPage === 1 ? data.logs : [...items, ...data.logs]);
      setPage(data.page);
      setHasMore(data.hasMore);
      setInactivityMinutes(data.inactivityWindowMinutes);
    } catch {
      setError(networkError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLoginPage(1)
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setError(translateServerMessage(response.status, { requestFailed, serverError }));
          return;
        }
        setLogs(data.logs);
        setPage(data.page);
        setHasMore(data.hasMore);
        setInactivityMinutes(data.inactivityWindowMinutes);
      })
      .catch(() => {
        if (active) setError(networkError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [networkError, requestFailed, serverError]);

  return (
    <div className="page-enter mx-auto max-w-[1100px]">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">{t.adminConsole}</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">{t.loginActivity}</h1>
        <p className="mt-1 text-[12px] text-[#8c938b]">{t.recentAccess}</p>
        <p className="mt-2 text-[11px] text-[#8c938b]">{String(t.inactivityWindow || "").replaceAll("{minutes}", inactivityMinutes == null ? "—" : String(inactivityMinutes))}</p>
      </div>
      {error && <p className="mb-4 rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-[#e5e7df] bg-[#fbfbf8]">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-[#e8e9e2] text-[9px] uppercase tracking-[.8px] text-[#959c93]">
            <tr>
              {[t.accountHeader, t.deviceHeader, t.locationHeader, t.ipAddress, t.signedIn].map((item) => <th key={item} className="px-4 py-3 font-semibold">{item}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eff0eb]">
            {logs.map((log) => (
              <tr key={log._id} className="text-[11px]">
                <td className="px-4 py-3"><span className="block font-medium">{log.user?.name || t.unknownUser}</span><span className="mt-1 block text-[10px] text-[#9da39a]">{log.user?.email}</span></td>
                <td className="px-4 py-3">{log.browser || "Unknown"} · {log.operatingSystem || log.os || "Unknown"} · {log.deviceType || "Unknown"}</td>
                <td className="px-4 py-3">{log.location || t.locationUnavailable}</td>
                <td className="px-4 py-3 font-mono text-[10px]">{log.ipAddress || "—"}</td>
                <td className="px-4 py-3 text-[#7d857b]">{new Date(log.loginAt || log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && <div className="py-12 text-center text-[11px] text-[#9ca299]"><ShieldCheck size={20} className="mx-auto mb-2 text-[#a1b092]" />{error || t.noLoginActivity}</div>}
      </div>
      {hasMore && <button disabled={loading} onClick={() => loadPage(page + 1)} className="mt-4 h-9 rounded-lg border border-[#dfe2d9] px-4 text-[11px] font-medium">{loading ? t.loading : t.seeAll}</button>}
    </div>
  );
}
