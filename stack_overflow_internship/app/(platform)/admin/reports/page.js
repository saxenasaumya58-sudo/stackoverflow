"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyReport, setBusyReport] = useState("");

  useEffect(() => {
    fetch("/api/admin/reports")
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401 || response.status === 403) {
          router.replace("/feed");
          return;
        }
        if (response.ok) setReports(data.reports || []);
        else setError(translateServerMessage(response.status, { requestFailed, serverError }));
      })
      .catch(() => setError(networkError))
      .finally(() => setLoading(false));
  }, [router, networkError, requestFailed, serverError]);

  async function review(reportId, action) {
    setBusyReport(reportId);
    setError("");
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        router.replace("/feed");
        return;
      }
      if (!response.ok) {
        setError(translateServerMessage(response.status, { requestFailed, serverError }));
        return;
      }
      setReports((items) => items.filter((item) => item._id !== reportId));
    } catch {
      setError(networkError);
    } finally {
      setBusyReport("");
    }
  }

  async function toggleSuspension(reportId, userId, isSuspended) {
    setBusyReport(reportId);
    setError("");
    try {
      const action = isSuspended ? "unsuspend" : "suspend";
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/${action}`,
        { method: "PATCH" },
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) {
        router.replace("/feed");
        return;
      }
      if (!response.ok) {
        setError(translateServerMessage(response.status, { requestFailed, serverError }));
        return;
      }
      const refreshed = await fetch("/api/admin/reports");
      const refreshedData = await refreshed.json().catch(() => ({}));
      if (refreshed.status === 401 || refreshed.status === 403) {
        router.replace("/feed");
        return;
      }
      if (!refreshed.ok) {
        setError(translateServerMessage(refreshed.status, { requestFailed, serverError }));
        return;
      }
      setReports(refreshedData.reports || []);
    } catch {
      setError(networkError);
    } finally {
      setBusyReport("");
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-[1100px]" aria-label={t.loadingReports}>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="mb-4 h-40 animate-pulse rounded-lg bg-gray-200"
          />
        ))}
      </div>
    );

  return (
    <div className="page-enter mx-auto max-w-[1100px]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">
            {t.moderation}
          </p>
          <h1 className="mt-2 text-[29px] font-semibold">{t.reportsQueue}</h1>
        </div>
        <span className="text-[11px] text-[#737b71]">{reports.length} {t.openCount}</span>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#e5e7df] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
          <thead className="bg-[#f4f5f0] text-[#737b71]">
            <tr>
              <th className="px-4 py-3 font-semibold">{t.postPreview}</th>
              <th className="px-4 py-3 font-semibold">{t.reason}</th>
              <th className="px-4 py-3 font-semibold">{t.reportedBy}</th>
              <th className="px-4 py-3 font-semibold">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const postId = report.post?._id;
              const reporter = report.reportedBy || report.reporter;
              const busy = busyReport === report._id;
              const authorId = report.post?.author?._id;
              const isSuspended = Boolean(
                report.post?.author?.isSuspended ||
                report.post?.author?.suspendedAt,
              );
              return (
                <tr key={report._id} className="border-t border-[#eceee7] align-top">
                  <td className="max-w-[280px] px-4 py-4">
                    <p className="line-clamp-3 text-[#424a43]">
                      {report.post?.content || t.postUnavailable}
                    </p>
                    <p className="mt-2 text-[10px] text-[#92998f]">
                      {t.authorLabel}: {report.post?.author?.name || t.unknown}
                    </p>
                  </td>
                  <td className="max-w-[220px] px-4 py-4 text-[#626a61]">
                    {report.reason}
                  </td>
                  <td className="px-4 py-4 text-[#626a61]">
                    {reporter?.name || t.unknown}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {postId && (
                        <a
                          href={`/feed#${postId}`}
                          className="rounded border border-[#dfe2d9] px-2.5 py-1.5 hover:bg-[#f4f5f0]"
                        >
                          {t.view}
                        </a>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => review(report._id, "dismiss")}
                        className="rounded border border-[#dfe2d9] px-2.5 py-1.5 hover:bg-[#f4f5f0] disabled:opacity-50"
                      >
                        {t.dismiss}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => review(report._id, "removePost")}
                        className="rounded bg-[#a75138] px-2.5 py-1.5 text-white hover:bg-[#883f2c] disabled:opacity-50"
                      >
                        {t.removePost}
                      </button>
                      {authorId && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            toggleSuspension(report._id, authorId, isSuspended)
                          }
                          className="rounded border border-[#a75138] px-2.5 py-1.5 text-[#994b36] hover:bg-[#fff2ed] disabled:opacity-50"
                        >
                          {isSuspended ? t.unsuspendUser : t.suspendUser}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!reports.length && (
          <p className="px-5 py-12 text-center text-[11px] text-[#8b9389]">
            {t.noPendingReports}
          </p>
        )}
      </div>
    </div>
  );
}