"use client";

import { useActionState } from "react";
import { submitAnswersAction, type LearnState } from "@/app/actions/learn";

const initial: LearnState = {};

export function FollowupsForm({
  submissionId,
  keywordId,
  followups,
}: {
  submissionId: string;
  keywordId: string;
  followups: { id: string; question: string }[];
}) {
  const [state, action, pending] = useActionState(submitAnswersAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="keywordId" value={keywordId} />
      {followups.map((f, i) => (
        <div key={f.id}>
          <label className="block text-sm font-medium text-ink">
            追问 {i + 1}：{f.question}
          </label>
          <textarea
            name="answer"
            rows={3}
            required
            placeholder="认真回答会影响最终评分"
            className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
      ))}
      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "AI 正在综合评定…" : "提交回答，看最终得分"}
      </button>
    </form>
  );
}
