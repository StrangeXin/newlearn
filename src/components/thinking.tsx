"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 提交评分用的流式 hook：POST 到流式路由，逐段收「思考过程」（reasoning），
 *  done 时刷新页面（进入下一步），error 时展示错误。JSON 结果由后端落库，前端不接触。 */
export function useReasoningStream() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState("");

  async function run(url: string, body: unknown) {
    setError("");
    setReasoning("");
    setPending(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        setError((await res.text().catch(() => "")) || "请求失败，请重试");
        setPending(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let r = "";
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
          if (ev.type === "reasoning") {
            r += ev.text ?? "";
            setReasoning(r);
          } else if (ev.type === "error") {
            setError(ev.text || "出错了，请重试");
            setPending(false);
            return;
          } else if (ev.type === "done") {
            router.refresh(); // 进入下一步（答追问 / 结果页），本组件随之卸载
            return;
          }
        }
      }
      router.refresh();
    } catch {
      setError("网络出错，请重试");
      setPending(false);
    }
  }

  return { pending, reasoning, error, run };
}

/** 评分等待时展示 AI 的思考过程（reasoning）。 */
export function ThinkingPanel({ label, reasoning }: { label: string; reasoning: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted">
        <span className="inline-block size-2 animate-pulse rounded-full bg-brand-500" aria-hidden />
        {label}
      </div>
      {reasoning ? (
        <div className="max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted">
          {reasoning}
        </div>
      ) : (
        <div className="text-xs text-muted">连接中…</div>
      )}
    </div>
  );
}
