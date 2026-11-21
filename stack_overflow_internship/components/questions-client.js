"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";

function VoteControls({ type, target, upvotes = 0, downvotes = 0, own, onVote }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function vote(value) {
    if (busy || own) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: type, target, value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Vote could not be recorded.");
      onVote(data);
    } catch (voteError) {
      setError(voteError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={busy || own}
        onClick={() => vote(1)}
        className="rounded border border-[#e1e5dc] px-2 py-1 disabled:opacity-40"
        aria-label="Upvote"
      >
        ▲ {upvotes}
      </button>
      <button
        type="button"
        disabled={busy || own}
        onClick={() => vote(-1)}
        className="rounded border border-[#e1e5dc] px-2 py-1 disabled:opacity-40"
        aria-label="Downvote"
      >
        ▼ {downvotes}
      </button>
      {own && <span className="text-[#90978e]">You cannot vote on your own item.</span>}
      {error && <span role="alert" className="text-[#994b36]">{error}</span>}
    </div>
  );
}

export default function QuestionsClient() {
  const router = useRouter();
  const { user } = useLanguage();
  const [questions, setQuestions] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadQuestions = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/questions", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Questions could not be loaded.");
      setQuestions(data.questions || []);
      setQuota(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function submitQuestion(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Question could not be posted.");
      router.push(`/questions/${data.question._id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-enter mx-auto max-w-[900px] space-y-5">
      <header className="rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
        <h1 className="text-2xl font-semibold">Community questions</h1>
        <p className="mt-1 text-sm text-[#747c72]">
          Ask, answer, vote, and recognize helpful answers.
        </p>
        {quota && (
          <p className="mt-3 text-xs text-[#687660]">
            Questions in the last 24 hours: {quota.used} / {quota.limit === -1 ? "Unlimited" : quota.limit}
          </p>
        )}
      </header>

      <form onSubmit={submitQuestion} className="space-y-3 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
        <h2 className="text-sm font-semibold">Ask a question</h2>
        <input
          required
          maxLength={180}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Question title"
          className="h-10 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-sm"
        />
        <textarea
          required
          maxLength={10000}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Include the details someone needs to answer."
          className="w-full rounded-lg border border-[#e1e4db] bg-white p-3 text-sm"
        />
        <button
          disabled={busy || Boolean(quota?.limitReached)}
          className="rounded-lg bg-[#293b29] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post question"}
        </button>
        {error && <p role="alert" className="text-xs text-[#994b36]">{error}</p>}
      </form>

      <section aria-label="Questions" className="space-y-3">
        {loading && <p className="text-sm text-[#747c72]">Loading questions…</p>}
        {!loading && !questions.length && (
          <p className="rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5 text-sm text-[#747c72]">
            No open questions yet.
          </p>
        )}
        {questions.map((question) => (
          <article key={question._id} className="rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/questions/${question._id}`}
                  className="text-base font-semibold text-[#293b29] hover:underline"
                >
                  {question.title}
                </Link>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-[#626a61]">
                  {question.body}
                </p>
              </div>
              <span className="rounded-full bg-[#edf3e4] px-2.5 py-1 text-[10px] font-semibold text-[#648047]">
                {question.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <VoteControls
                type="question"
                target={question._id}
                upvotes={question.upvotes}
                downvotes={question.downvotes}
                own={String(question.author?._id) === String(user?.id)}
                onVote={(result) =>
                  setQuestions((items) =>
                    items.map((item) =>
                      item._id === question._id
                        ? { ...item, upvotes: result.upvotes, downvotes: result.downvotes }
                        : item,
                    ),
                  )
                }
              />
              <span className="text-xs text-[#858c82]">
                Asked by {question.author?.name || "Community member"}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
