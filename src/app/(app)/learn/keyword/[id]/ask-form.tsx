"use client";

import { useRef, useState } from "react";
import { Markdown } from "@/components/markdown";

const QUESTION_MAX = 1000;

interface QA {
  question: string;
  answer: string;
  reasoning: string;
}

export function AskForm({
  submissionId,
  initialQA,
}: {
  submissionId: string;
  initialQA: QA[];
}) {
  const [qa, setQa] = useState<QA[]>(initialQA);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = taRef.current?.value.trim() ?? "";
    if (!question || pending) return;
    setError("");
    setPending(true);

    const idx = qa.length;
    setQa((prev) => [...prev, { question, answer: "", reasoning: "" }]);
    if (taRef.current) taRef.current.value = "";

    try {
      const res = await fetch("/api/learn/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, question }),
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text().catch(() => "")) || "提问失败，请重试";
        setError(msg);
        setQa((prev) => prev.slice(0, idx));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let answer = "";
      let reasoning = "";
      const flush = () =>
        setQa((prev) => {
          const next = prev.slice();
          next[idx] = { question, answer, reasoning };
          return next;
        });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type?: string; text?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "reasoning") reasoning += ev.text ?? "";
          else answer += ev.text ?? "";
        }
        flush();
      }
    } catch {
      setError("网络出错，请重试");
      setQa((prev) => prev.slice(0, idx));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-left">
      {qa.length > 0 && (
        <ul className="mb-3 space-y-2.5">
          {qa.map((item, i) => {
            const streaming = pending && i === qa.length - 1;
            return (
              <li key={i} className="rounded-xl border border-line p-3">
                <p className="text-sm font-medium text-ink">
                  <span className="badge badge-brand mr-2">问</span>
                  {item.question}
                </p>

                {item.reasoning &&
                  (streaming ? (
                    <div className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <div className="mb-1 text-xs font-medium text-muted">思考过程</div>
                      <div className="max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">
                        {item.reasoning}
                      </div>
                    </div>
                  ) : (
                    <details className="mt-2 rounded-lg border border-line bg-surface-2 [&[open]>summary>.rc]:rotate-180">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted">
                        <span>思考过程</span>
                        <span className="rc transition-transform" aria-hidden>
                          ▾
                        </span>
                      </summary>
                      <div className="max-h-52 overflow-auto whitespace-pre-wrap border-t border-line px-3 py-2 text-xs leading-relaxed text-muted">
                        {item.reasoning}
                      </div>
                    </details>
                  ))}

                <div className="mt-2 rounded-lg bg-brand-50 p-3">
                  {item.answer ? (
                    <Markdown>{item.answer}</Markdown>
                  ) : (
                    <p className="text-sm text-muted">
                      {streaming ? "AI 正在作答…" : "（无内容）"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          ref={taRef}
          rows={2}
          required
          maxLength={QUESTION_MAX}
          disabled={pending}
          placeholder="对这个词还有疑问？问问 AI，它会结合你的笔记和岗位来答。"
          className="textarea"
        />
        <div className="flex items-center justify-between gap-2">
          {error ? (
            <span className="field-error">{error}</span>
          ) : (
            <span className="field-hint">回答即时显示在上方，可多次提问</span>
          )}
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm shrink-0">
            {pending ? "AI 正在作答…" : "提问"}
          </button>
        </div>
      </form>
    </div>
  );
}
