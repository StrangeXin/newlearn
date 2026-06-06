"use client";

import { useEffect, useRef, useState } from "react";
import { saveAnswersDraftAction } from "@/app/actions/draft";
import { ThinkingPanel, useReasoningStream } from "@/components/thinking";

const AUTOSAVE_MS = 1200;
const ANSWER_MAX = 1000;

export function FollowupsForm({
  submissionId,
  followups,
  initialAnswers = [],
}: {
  submissionId: string;
  followups: { id: string; question: string }[];
  initialAnswers?: string[];
}) {
  const { pending, reasoning, error, run } = useReasoningStream();
  const [answers, setAnswers] = useState<string[]>(
    followups.map((_, i) => initialAnswers[i] ?? ""),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitting = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  // 静默自动保存回答（中途退出保留记录），不在界面上提示
  function scheduleSave(next: string[]) {
    clearTimeout(timer.current);
    if (submitting.current) return;
    timer.current = setTimeout(() => {
      saveAnswersDraftAction(submissionId, next).catch(() => {});
    }, AUTOSAVE_MS);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    submitting.current = true;
    clearTimeout(timer.current);
    await run("/api/learn/finalize", { submissionId, answers });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {followups.map((f, i) => (
        <div key={f.id}>
          <label className="field-label">
            <span className="badge badge-brand mr-2">追问 {i + 1}</span>
            {f.question}
          </label>
          <textarea
            rows={3}
            required
            maxLength={ANSWER_MAX}
            disabled={pending}
            value={answers[i] ?? ""}
            onChange={(e) => {
              const next = answers.slice();
              next[i] = e.target.value;
              setAnswers(next);
              scheduleSave(next);
            }}
            placeholder="结合你的工作写具体一点"
            className="textarea mt-1"
          />
          <div className="mt-1 text-right text-xs text-muted tabular-nums">
            {(answers[i] ?? "").length} / {ANSWER_MAX}
          </div>
        </div>
      ))}
      {error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">回答已自动保存，中途退出也不丢</span>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "AI 正在综合评定…" : "提交回答，看最终得分"}
        </button>
      </div>
      {pending && <ThinkingPanel label="AI 正在综合评定…" reasoning={reasoning} />}
    </form>
  );
}
