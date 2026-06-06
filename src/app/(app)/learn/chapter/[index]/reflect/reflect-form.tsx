"use client";

import { useRef, useState } from "react";
import { ThinkingPanel, useReasoningStream } from "@/components/thinking";

export function ReflectForm({
  chapterId,
  questions,
}: {
  chapterId: string;
  questions: string[];
}) {
  const { pending, reasoning, error, run } = useReasoningStream();
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [vErr, setVErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const answers = questions.map((_, i) => (refs.current[i]?.value ?? "").trim());
    if (answers.some((a) => a.length === 0)) {
      setVErr("把每个问题都答一下再提交（哪怕一两句也行）。");
      return;
    }
    setVErr("");
    await run("/api/learn/reflect", { chapterId, answers });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
            ref={(el) => {
              refs.current[i] = el;
            }}
            rows={4}
            disabled={pending}
            placeholder="举一个你工作里能用上的具体例子"
            className="textarea"
          />
        </div>
      ))}
      {(vErr || error) && (
        <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium" role="alert">
          {vErr || error}
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
      {pending && <ThinkingPanel label="AI 正在结合你的岗位思考本章小结…" reasoning={reasoning} />}
    </form>
  );
}
