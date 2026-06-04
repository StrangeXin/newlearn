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

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="keywordId" value={keywordId} />
      <textarea
        name="note"
        rows={12}
        onChange={(e) => setLen(e.target.value.trim().length)}
        placeholder="去外面检索、阅读后，用自己的话把这个关键词总结清楚（100–5000 字）。写出原理、机制、例子和你的理解。"
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <div className="flex items-center justify-between text-sm">
        <span className={tooShort || tooLong ? "text-danger-500" : "text-muted"}>
          {len} 字
          {tooShort && `（还差 ${NOTE_MIN - len} 字）`}
          {tooLong && `（超出 ${len - NOTE_MAX} 字）`}
        </span>
        <button
          type="submit"
          disabled={pending || tooShort || tooLong}
          className="rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "AI 正在阅读你的笔记…" : "提交，让 AI 打分"}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{state.error}</p>
      )}
    </form>
  );
}
