"use client";

import { useActionState, useTransition } from "react";
import {
  setActiveSubjectAction,
  setStartDateAction,
  updateKeywordAction,
  type AdminState,
} from "@/app/actions/admin";

const initial: AdminState = {};
const inputClass =
  "rounded-xl border border-brand-200 bg-white px-3 py-2 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function SetActiveButton({ subjectId, active }: { subjectId: string; active: boolean }) {
  const [pending, start] = useTransition();
  if (active) {
    return <span className="rounded-full bg-success-500/15 px-3 py-1 text-xs font-bold text-success-500">当前学科</span>;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setActiveSubjectAction(subjectId)))}
      className="rounded-lg border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
    >
      设为当前
    </button>
  );
}

export function StartDateForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(setStartDateAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="date" name="startDate" defaultValue={value} className={inputClass} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        保存开始日
      </button>
      {state?.error && <span className="text-sm text-danger-500">{state.error}</span>}
      {state?.ok && <span className="text-sm text-success-500">已保存 ✓</span>}
    </form>
  );
}

export function KeywordEditor({
  keywordId,
  term,
  description,
  referencePoints,
}: {
  keywordId: string;
  term: string;
  description: string;
  referencePoints: string;
}) {
  const [state, action, pending] = useActionState(updateKeywordAction, initial);
  return (
    <details className="rounded-xl border border-brand-100 bg-white/80 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-ink">{term}</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="keywordId" value={keywordId} />
        <div>
          <label className="text-xs text-muted">简介</label>
          <textarea name="description" rows={2} defaultValue={description} className={`w-full ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs text-muted">参考考核要点（辅助 AI 打分；分号分隔）</label>
          <textarea
            name="referencePoints"
            rows={2}
            defaultValue={referencePoints}
            className={`w-full ${inputClass}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            保存
          </button>
          {state?.error && <span className="text-xs text-danger-500">{state.error}</span>}
          {state?.ok && <span className="text-xs text-success-500">已保存 ✓</span>}
        </div>
      </form>
    </details>
  );
}
