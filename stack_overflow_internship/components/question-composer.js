"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

async function fetchQuestionQuota() {
  const response = await fetch("/api/questions");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not load question limits.");
  return data;
}

export default function QuestionComposer() {
  const { t, user } = useLanguage();
  const messages = t.questionComposer || {};
  const [question, setQuestion] = useState("");
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setQuota(null);
      setQuotaLoading(false);
      return;
    }

    let active = true;
    setQuotaLoading(true);
    fetchQuestionQuota()
      .then((data) => {
        if (active) {
          setQuota(data);
          setQuotaError("");
        }
      })
      .catch((error) => {
        console.error("Question quota loading failed", error);
        if (active) setQuotaError(messages.quotaError || error.message);
      })
      .finally(() => {
        if (active) setQuotaLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, messages.quotaError]);

  async function submitQuestion(event) {
    event.preventDefault();
    const body = question.trim();
    if (!body) {
      setStatus({ type: "error", text: messages.required });
      return;
    }

    const title = body.split(/\r?\n/, 1)[0].trim();
    if (title.length > 180) {
      setStatus({ type: "error", text: messages.titleTooLong });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) {
          setStatus(null);
          try {
            setQuota(await fetchQuestionQuota());
            setQuotaError("");
          } catch (error) {
            console.error("Question quota refresh failed", error);
            setQuotaError(messages.quotaError || error.message);
            setStatus({
              type: "error",
              text: data.error || messages.postFailed,
            });
          }
        } else {
          setStatus({
            type: "error",
            text: data.error || messages.postFailed,
          });
        }
        return;
      }

      setQuestion("");
      setStatus({ type: "success", text: messages.posted });
      if (data.quota) setQuota(data.quota);
    } catch (error) {
      console.error("Question posting failed", error);
      setStatus({
        type: "error",
        text: messages.postFailed || error.message,
      });
    } finally {
      setBusy(false);
    }
  }

  const limitReached = Boolean(quota?.limitReached);
  const usage = quota
    ? (messages.usage || "Questions in the last 24 hours: {used} / {limit}")
        .replace("{used}", String(quota.used))
        .replace(
          "{limit}",
          quota.limit === -1
            ? messages.unlimited || "Unlimited"
            : String(quota.limit),
        )
    : "";

  return (
    <section
      aria-labelledby="question-composer-heading"
      className="mb-5 rounded-xl border border-[#e5e7df] bg-white p-5 shadow-[0_2px_8px_#21251a08]"
    >
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText size={18} className="text-[#687660]" aria-hidden="true" />
        <h2
          id="question-composer-heading"
          className="text-sm font-semibold text-[#29372b]"
        >
          {messages.heading || "Ask a question"}
        </h2>
      </div>

      {user?.id ? (
        <form onSubmit={submitQuestion}>
          <label htmlFor="question-composer-input" className="sr-only">
            {messages.heading || "Ask a question"}
          </label>
          <textarea
            id="question-composer-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={messages.placeholder || "What do you need help with?"}
            maxLength={10000}
            rows={4}
            aria-describedby="question-composer-hint question-limit-status"
            className="w-full resize-y rounded-lg border border-[#e5e7df] bg-[#fbfbf8] px-4 py-3 text-sm text-[#29372b] outline-none transition placeholder:text-[#9aa096] focus:border-[#98c262] focus:ring-2 focus:ring-[#c7f36b]/40"
          />
          <p
            id="question-composer-hint"
            className="mt-1 text-[11px] text-[#858c82]"
          >
            {messages.hint ||
              "Use the first line as the question title (180 characters max)."}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="rounded-lg bg-[#29372b] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#3b503d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? messages.posting || "Posting..."
                : messages.post || "Post question"}
            </button>
            <span className="text-[11px] text-[#858c82]">
              {question.length}/10000
            </span>
          </div>

          <div
            id="question-limit-status"
            className="mt-3"
            aria-live="polite"
          >
            {quotaLoading && (
              <p className="text-xs text-[#858c82]">
                {messages.loadingQuota || "Loading your question limit..."}
              </p>
            )}
            {!quotaLoading && quota && (
              <p
                role={limitReached ? "alert" : "status"}
                className={`text-xs ${limitReached ? "text-[#98432b]" : "text-[#687660]"}`}
              >
                {limitReached ? (
                  <>
                    {messages.limitReached || "Daily limit reached."}{" "}
                    <Link
                      href="/subscription"
                      className="font-semibold underline underline-offset-2"
                    >
                      {messages.upgrade || "Upgrade your plan to post more questions."}
                    </Link>
                  </>
                ) : (
                  usage
                )}
              </p>
            )}
            {quotaError && (
              <p role="alert" className="text-xs text-[#98432b]">
                {quotaError}
              </p>
            )}
            {status && (
              <p
                role={status.type === "error" ? "alert" : "status"}
                className={`mt-2 text-xs ${status.type === "error" ? "text-[#98432b]" : "text-[#42623a]"}`}
              >
                {status.text}
              </p>
            )}
          </div>
        </form>
      ) : (
        <p className="text-sm text-[#858c82]">
          {messages.signIn || "Sign in to post a question."}{" "}
          <Link
            href="/login"
            className="font-semibold text-[#29372b] underline underline-offset-2"
          >
            {t.signIn}
          </Link>
        </p>
      )}
    </section>
  );
}
