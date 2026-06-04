"use client";

import { useActionState } from "react";
import { submitReflectionAction, type ReflectState } from "@/app/actions/reflection";

const initial: ReflectState = {};

export function ReflectForm({
  chapterId,
  chapterIndex,
  questions,
}: {
  chapterId: string;
  chapterIndex: number;
  questions: string[];
}) {
  const [state, action, pending] = useActionState(submitReflectionAction, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="chapterId" value={chapterId} />
      <input type="hidden" name="chapterIndex" value={chapterIndex} />
      {questions.map((q, i) => (
        <div key={i}>
          <label className="block text-sm font-medium text-ink">
            {i + 1}. {q}
          </label>
          <textarea
            name="answer"
            rows={3}
            required
            placeholder="结合你的实际工作认真写"
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
        {pending ? "AI 正在总结…" : "提交反思，看总结"}
      </button>
    </form>
  );
}
