"use client";

import { useActionState, useTransition } from "react";
import {
  createSubjectAction,
  importSubjectContentAction,
  setActiveSubjectAction,
  setStartDateAction,
  updateKeywordAction,
  type AdminState,
} from "@/app/actions/admin";

const initial: AdminState = {};

export function SetActiveButton({ subjectId, active }: { subjectId: string; active: boolean }) {
  const [pending, start] = useTransition();
  if (active) {
    return <span className="badge badge-success">✓ 当前学科</span>;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setActiveSubjectAction(subjectId)))}
      className="btn btn-secondary btn-sm"
    >
      设为当前
    </button>
  );
}

export function StartDateForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(setStartDateAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="date" name="startDate" defaultValue={value} className="input w-auto" />
      <button type="submit" disabled={pending} className="btn btn-primary">
        保存开始日
      </button>
      {state?.error && <span className="field-error">{state.error}</span>}
      {state?.ok && <span className="text-sm font-medium text-success-600">已保存 ✓</span>}
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
  const filled = Boolean(description && referencePoints);
  return (
    <details className="panel px-4 py-3 [&[open]>summary>.kw-caret]:rotate-90">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-ink">
        <span className="kw-caret text-xs text-muted transition-transform" aria-hidden>
          ▶
        </span>
        <span className="flex-1 truncate">{term}</span>
        {filled ? (
          <span className="badge badge-success shrink-0">✓ 已补全</span>
        ) : (
          <span className="badge badge-muted shrink-0">待补全</span>
        )}
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="keywordId" value={keywordId} />
        <div>
          <label className="field-label">简介</label>
          <p className="field-hint mb-1">员工在关键词页能看到，一两句话说清这个词指什么。</p>
          <textarea name="description" rows={2} defaultValue={description} className="textarea" />
        </div>
        <div>
          <label className="field-label">参考考核要点</label>
          <p className="field-hint mb-1">只用于辅助 AI 打分，员工看不到。多个要点用分号分隔。</p>
          <textarea
            name="referencePoints"
            rows={2}
            defaultValue={referencePoints}
            className="textarea"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            保存
          </button>
          {state?.error && <span className="field-error">{state.error}</span>}
          {state?.ok && <span className="text-xs font-medium text-success-600">已保存 ✓</span>}
        </div>
      </form>
    </details>
  );
}

export function CreateSubjectForm() {
  const [state, action, pending] = useActionState(createSubjectAction, initial);
  return (
    <div>
      <label className="field-label">新建学科</label>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input
          name="title"
          required
          placeholder="学科名称，如「人工智能」「医学」「心理学」"
          className="input flex-1"
        />
        <button type="submit" disabled={pending} className="btn btn-primary">
          新建学科
        </button>
        {state?.error && <span className="field-error w-full">{state.error}</span>}
        {state?.ok && (
          <span className="w-full text-sm font-medium text-success-600">
            已创建，下方可导入它的章节内容 ✓
          </span>
        )}
      </form>
    </div>
  );
}

export function ImportContentForm({ subjectId }: { subjectId: string }) {
  const [state, action, pending] = useActionState(importSubjectContentAction, initial);
  return (
    <details className="panel px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-semibold text-brand-700">
        导入章节内容（JSON）
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="subjectId" value={subjectId} />
        <div>
          <label className="field-label">内容 JSON</label>
          <p className="field-hint mb-1">
            结构同 prisma/seed-data：chapters 数组，每章含 index、title、theme 与 keywords。一次导入 5 章 100 词，导入后只能内联编辑，不能再次整体导入。
          </p>
          <textarea
            name="json"
            rows={6}
            placeholder='{"chapters":[{"index":1,"title":"...","theme":"...","keywords":[{"term":"...","description":"...","referencePoints":"..."}]}]}'
            className="textarea font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            导入内容
          </button>
          {state?.error && <span className="field-error">{state.error}</span>}
          {state?.ok && <span className="text-xs font-medium text-success-600">已导入 ✓</span>}
        </div>
      </form>
    </details>
  );
}
