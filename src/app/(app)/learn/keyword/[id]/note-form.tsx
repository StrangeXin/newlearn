"use client";

import { useActionState, useState } from "react";
import { submitNoteAction, type LearnState } from "@/app/actions/learn";

const initial: LearnState = {};
const NOTE_MIN = 100;
const NOTE_MAX = 5000;

export function NoteForm({ keywordId }: { keywordId: string }) {
  const [state, action, pending] = useActionState(submitNoteAction, initial);
  const [len, setLen] = useState(0);
  const tooShort = len < NOTE_MIN;
  const tooLong = len > NOTE_MAX;

  const empty = len === 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="keywordId" value={keywordId} />
      <textarea
        name="note"
        rows={12}
        aria-label="学习笔记"
        onChange={(e) => setLen(e.target.value.trim().length)}
        placeholder="检索后用自己的话总结（100–5000 字）。原理、机制、例子，写明白才算数。"
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
      {state?.error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
