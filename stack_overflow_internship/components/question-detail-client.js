"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import {
  hasReputationPrivilege,
  REPUTATION_AWARDS,
  REPUTATION_MILESTONES,
  REPUTATION_PRIVILEGES,
} from "@/lib/reputation-policy.mjs";

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
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" disabled={busy || own} onClick={() => vote(1)} className="rounded border border-[#e1e5dc] px-2 py-1 disabled:opacity-40" aria-label="Upvote">▲ {upvotes}</button>
      <button type="button" disabled={busy || own} onClick={() => vote(-1)} className="rounded border border-[#e1e5dc] px-2 py-1 disabled:opacity-40" aria-label="Downvote">▼ {downvotes}</button>
      {own && <span className="text-[#90978e]">You cannot vote on your own item.</span>}
      {error && <span role="alert" className="text-[#994b36]">{error}</span>}
    </div>
  );
}

export default function QuestionDetailClient({ questionId }) {
  const { user, setUser } = useLanguage();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [closeVotes, setCloseVotes] = useState(0);
  const [answerBody, setAnswerBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/questions/${questionId}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Question could not be loaded.");
    setQuestion(data.question);
    setAnswers(data.answers || []);
    setCloseVotes(data.closeVotes || 0);
  }, [questionId]);

  useEffect(() => {
    refresh()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function refreshUser() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (data.user) setUser((current) => ({ ...current, ...data.user }));
  }

  async function submitAnswer(event) {
    event.preventDefault();
    if (!answerBody.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: answerBody.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Answer could not be posted.");
      setAnswerBody("");
      setNotice(
        `Answer posted. You earned ${REPUTATION_AWARDS.answerPosted} reputation points.`,
      );
      await Promise.all([refresh(), refreshUser()]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function acceptAnswer(answerId) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/questions/${questionId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Answer could not be accepted.");
      setNotice(
        `Answer accepted. The author earned ${REPUTATION_AWARDS.answerAccepted} reputation points.`,
      );
      await refresh();
    } catch (acceptError) {
      setError(acceptError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnswer(answerId) {
    if (
      !window.confirm(
        `Delete this answer? This removes ${Math.abs(REPUTATION_AWARDS.answerDeleted)} reputation points.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/questions/${questionId}/answers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Answer could not be deleted.");
      setNotice(
        `Answer deleted. ${Math.abs(REPUTATION_AWARDS.answerDeleted)} reputation points were deducted.`,
      );
      await Promise.all([refresh(), refreshUser()]);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  async function voteToClose() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/questions/${questionId}/close-vote`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Close vote could not be recorded.");
      setCloseVotes(data.votes);
      if (data.closed)
        setQuestion((current) => ({ ...current, status: "closed" }));
      setNotice(data.closed ? "The question was closed." : `Close vote recorded (${data.votes}/3).`);
    } catch (closeError) {
      setError(closeError.message);
    } finally {
      setBusy(false);
    }
  }

  function updateQuestionVote(result) {
    const earnedQuestionBonus =
      Number(question.upvotes) < REPUTATION_MILESTONES.questionUpvotes &&
      result.upvotes >= REPUTATION_MILESTONES.questionUpvotes;
    setQuestion((current) => ({
      ...current,
      upvotes: result.upvotes,
      downvotes: result.downvotes,
    }));
    if (earnedQuestionBonus)
      setNotice(
        `Question reached ${REPUTATION_MILESTONES.questionUpvotes} upvotes. Its author earned ${REPUTATION_AWARDS.questionTenUpvotes} reputation points.`,
      );
  }

  function updateAnswerVote(answerId, result) {
    const previousAnswer = answers.find(
      (answer) => String(answer._id) === String(answerId),
    );
    const earnedAnswerBonus =
      Number(previousAnswer?.upvotes) < REPUTATION_MILESTONES.answerUpvotes &&
      result.upvotes >= REPUTATION_MILESTONES.answerUpvotes;
    setAnswers((current) =>
      current.map((answer) =>
        answer._id === answerId
          ? { ...answer, upvotes: result.upvotes, downvotes: result.downvotes }
          : answer,
      ),
    );
    if (earnedAnswerBonus)
      setNotice(
        `Answer reached ${REPUTATION_MILESTONES.answerUpvotes} upvotes. Its author earned ${REPUTATION_AWARDS.answerFiveUpvotes} extra reputation points.`,
      );
  }

  if (loading) return <p className="text-sm text-[#747c72]">Loading question…</p>;
  if (error && !question) return <p role="alert" className="text-sm text-[#994b36]">{error}</p>;
  if (!question) return null;

  const ownsQuestion = String(question.author?._id) === String(user?.id);
  const canClose =
    user?.role === "admin" ||
    hasReputationPrivilege(
      user?.reputation,
      REPUTATION_PRIVILEGES.closeQuestion,
    );

  return (
    <div className="page-enter mx-auto max-w-[900px] space-y-5">
      <Link href="/questions" className="text-xs font-medium text-[#55713d] hover:underline">← All questions</Link>
      <article className="space-y-4 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{question.title}</h1>
            <span className="rounded-full bg-[#edf3e4] px-2.5 py-1 text-[10px] font-semibold text-[#648047]">{question.status}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#626a61]">{question.body}</p>
          <p className="mt-3 text-xs text-[#858c82]">Asked by {question.author?.name || "Community member"}</p>
        </div>
        <VoteControls
          type="question"
          target={question._id}
          upvotes={question.upvotes}
          downvotes={question.downvotes}
          own={ownsQuestion}
          onVote={updateQuestionVote}
        />
        {canClose ? (
          <button type="button" disabled={busy || question.status !== "open"} onClick={voteToClose} className="rounded border border-[#e1e5dc] px-3 py-2 text-xs disabled:opacity-40">Vote to close ({closeVotes}/3)</button>
        ) : (
          <p className="text-xs text-[#858c82]">Voting to close requires {REPUTATION_PRIVILEGES.closeQuestion} reputation points.</p>
        )}
      </article>

      {notice && <p role="status" className="rounded-lg bg-[#edf3e4] p-3 text-xs text-[#42623a]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#fff0eb] p-3 text-xs text-[#994b36]">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Answers ({answers.length})</h2>
        {!answers.length && <p className="text-sm text-[#747c72]">Be the first to answer.</p>}
        {answers.map((answer) => {
          const ownAnswer = String(answer.author?._id) === String(user?.id);
          return (
            <article key={answer._id} className="space-y-3 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
              {answer.accepted && <p className="text-xs font-semibold text-[#527936]">✓ Accepted answer · +{REPUTATION_AWARDS.answerAccepted} reputation</p>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#424a43]">{answer.body}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <VoteControls
                  type="answer"
                  target={answer._id}
                  upvotes={answer.upvotes}
                  downvotes={answer.downvotes}
                  own={ownAnswer}
                  onVote={(result) => updateAnswerVote(answer._id, result)}
                />
                <span className="text-xs text-[#858c82]">Answered by {answer.author?.name || "Community member"}</span>
              </div>
              {ownsQuestion && !answer.accepted && (
                <button type="button" disabled={busy} onClick={() => acceptAnswer(answer._id)} className="rounded bg-[#eaf1e0] px-3 py-2 text-xs font-semibold text-[#527936] disabled:opacity-50">Accept answer (+{REPUTATION_AWARDS.answerAccepted})</button>
              )}
              {ownAnswer && (
                <button type="button" disabled={busy} onClick={() => deleteAnswer(answer._id)} className="ml-2 rounded border border-[#e5c4b8] px-3 py-2 text-xs text-[#994b36] disabled:opacity-50">Delete answer (−{Math.abs(REPUTATION_AWARDS.answerDeleted)})</button>
              )}
              {answer.upvotes >= REPUTATION_MILESTONES.answerUpvotes && <p className="text-xs text-[#527936]">{REPUTATION_MILESTONES.answerUpvotes}-upvote answer bonus earned.</p>}
            </article>
          );
        })}
      </section>

      {question.status === "open" && (
        <form onSubmit={submitAnswer} className="space-y-3 rounded-xl border border-[#e3e6dd] bg-[#fbfbf8] p-5">
          <h2 className="text-sm font-semibold">Your answer</h2>
          <textarea required maxLength={10000} rows={5} value={answerBody} onChange={(event) => setAnswerBody(event.target.value)} placeholder="Write a helpful answer…" className="w-full rounded-lg border border-[#e1e4db] bg-white p-3 text-sm" />
          <button disabled={busy || !answerBody.trim()} className="rounded-lg bg-[#293b29] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : `Post answer (+${REPUTATION_AWARDS.answerPosted})`}</button>
        </form>
      )}
    </div>
  );
}
