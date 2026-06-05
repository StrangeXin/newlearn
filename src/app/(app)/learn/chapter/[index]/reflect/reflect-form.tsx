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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          共 {questions.length} 个问题，写你真实的想法，没有标准答案。
        </p>
        <span className="badge badge-brand shrink-0">结合岗位</span>
      </div>
      {questions.map((q, i) => (
        <div key={i}>
          <label className="field-label flex gap-2">
            <span className="text-brand-700">{i + 1}.</span>
            <span>{q}</span>
          </label>
          <textarea
            name="answer"
            rows={4}
            required
            placeholder="举一个你工作里能用上的具体例子"
            className="textarea"
          />
        </div>
      ))}
      {state?.error && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn btn-primary btn-block btn-lg">
          {pending ? "AI 正在读你的反思…" : "提交反思，生成本章小结"}
        </button>
        <p className="field-hint mt-2 text-center">
          提交后 AI 会给出本章小结，并据此更新你的成长画像。
        </p>
      </div>
    </form>
  );
}
