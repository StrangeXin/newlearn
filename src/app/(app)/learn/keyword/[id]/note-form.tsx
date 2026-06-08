"use client";

import { useEffect, useRef, useState } from "react";
import { saveNoteDraftAction } from "@/app/actions/draft";
import { ThinkingPanel, useReasoningStream } from "@/components/thinking";
import { AUTOSAVE_MS, NOTE_MAX, NOTE_MIN } from "@/lib/learn-limits";

export function NoteForm({
  keywordId,
  initialNote = "",
}: {
  keywordId: string;
  initialNote?: string;
}) {
  const { pending, reasoning, error, run } = useReasoningStream();
  const [len, setLen] = useState(initialNote.trim().length);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitting = useRef(false);

  const tooShort = len < NOTE_MIN;
  const tooLong = len > NOTE_MAX;
  const empty = len === 0;

  useEffect(() => () => clearTimeout(timer.current), []);

  // 静默自动保存草稿（中途退出保留记录），不在界面上提示
  function scheduleSave(value: string) {
    clearTimeout(timer.current);
    if (submitting.current) return;
    timer.current = setTimeout(() => {
      saveNoteDraftAction(keywordId, value).catch(() => {});
    }, AUTOSAVE_MS);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const note = taRef.current?.value ?? "";
    const t = note.trim();
    if (pending || t.length < NOTE_MIN || t.length > NOTE_MAX) return;
    submitting.current = true;
    clearTimeout(timer.current);
    await run("/api/learn/submit", { keywordId, note });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        ref={taRef}
        rows={12}
        aria-label="学习笔记"
        defaultValue={initialNote}
        disabled={pending}
        onChange={(e) => {
          setLen(e.target.value.trim().length);
          scheduleSave(e.target.value);
        }}
        placeholder="检索后用自己的话总结（100–2000 字）。原理、机制、例子，写明白才算数。"
        className="textarea"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={tooShort || tooLong ? "field-error" : "field-hint"}>
          {len} 字
          {empty
            ? `（至少 ${NOTE_MIN} 字）`
            : tooShort
              ? `（还差 ${NOTE_MIN - len} 字）`
              : tooLong
                ? `（超出 ${len - NOTE_MAX} 字）`
                : " · 可以提交了"}
        </span>
        <button type="submit" disabled={pending || tooShort || tooLong} className="btn btn-primary">
          {pending ? "AI 正在阅读你的笔记…" : "提交，让 AI 打分"}
        </button>
      </div>
      {error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      {pending && <ThinkingPanel label="AI 正在阅读并思考你的笔记…" reasoning={reasoning} />}
    </form>
  );
}
