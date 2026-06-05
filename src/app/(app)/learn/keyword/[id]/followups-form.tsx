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
          <label className="field-label">
            <span className="badge badge-brand mr-2">追问 {i + 1}</span>
            {f.question}
          </label>
          <textarea
            name="answer"
            rows={3}
            required
            placeholder="结合你的工作具体作答"
            className="textarea mt-1"
          />
        </div>
      ))}
      {state?.error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "AI 正在综合评定…" : "提交回答，看最终得分"}
      </button>
    </form>
  );
}
