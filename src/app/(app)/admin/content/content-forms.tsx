"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createSubjectAction,
  importSubjectContentAction,
  toggleSubjectActiveAction,
  setStartDateAction,
  updateKeywordAction,
  type AdminState,
} from "@/app/actions/admin";
import { KeywordIllustrationAdminPanel } from "@/components/keyword-illustration";

const initial: AdminState = {};

/** 上线 / 下线学科（可同时上线多个）。下线后员工侧不再可见。 */
export function ToggleActiveButton({
  subjectId,
  active,
  disabled,
}: {
  subjectId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <span className="flex items-center gap-2">
      {err && <span className="field-error">{err}</span>}
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await toggleSubjectActiveAction(subjectId, !active);
            setErr(r?.error ?? "");
          })
        }
        className={active ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
        title={disabled ? "先导入章节内容再上线" : undefined}
      >
        {active ? "下线" : "上线"}
      </button>
    </span>
  );
}

export function StartDateForm({ subjectId, value }: { subjectId: string; value: string }) {
  const [state, action, pending] = useActionState(setStartDateAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="subjectId" value={subjectId} />
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
  illustrationSrc,
}: {
  keywordId: string;
  term: string;
  description: string;
  referencePoints: string;
  illustrationSrc?: string | null;
}) {
  const [state, action, pending] = useActionState(updateKeywordAction, initial);
  const filled = Boolean(description && referencePoints);
  return (
    <details className="details-chevron panel px-4 py-3">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-ink">
        <span className="kw-caret" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{term}</span>
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
        <p className="field-hint mb-1">员工可见，一两句话讲清这个词指什么。</p>
        <textarea name="description" rows={2} defaultValue={description} className="textarea" />
      </div>
      <div>
        <label className="field-label">参考考核要点</label>
        <p className="field-hint mb-1">员工看不到；多个要点用分号分隔。</p>
        <textarea
          name="referencePoints"
          rows={2}
          defaultValue={referencePoints}
          className="textarea"
        />
      </div>
        <KeywordIllustrationAdminPanel term={term} src={illustrationSrc} />
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
          placeholder="学科名，如「人工智能」「医学」"
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
