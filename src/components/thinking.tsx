"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** NDJSON 流的一帧：{type:"reasoning"|"answer"|"done"|"error", text?}（见 src/lib/ndjson.ts）。 */
export interface NdjsonFrame {
  type?: string;
  text?: string;
}

/** 可直接展示给用户的错误（来自 error 帧或 HTTP 错误体）；其它异常视为网络错误。 */
export class StreamError extends Error {}

/**
 * 消费一个 NDJSON 流：POST 后逐行解析帧交给 onFrame（解析失败的行跳过）。
 * HTTP 失败时抛 StreamError（携带服务端文案）；fetch/读取异常按普通 Error 抛出（视为网络错误）。
 * 编解码逻辑只此一处，submit/finalize/reflect/ask 客户端共用。
 */
export async function consumeNdjson(
  url: string,
  body: unknown,
  onFrame: (frame: NdjsonFrame) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new StreamError((await res.text().catch(() => "")) || "请求失败，请重试");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let frame: NdjsonFrame;
      try {
        frame = JSON.parse(line);
      } catch {
        continue;
      }
      onFrame(frame);
    }
  }
}

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
    let r = "";
    try {
      await consumeNdjson(url, body, (frame) => {
        if (frame.type === "reasoning") {
          r += frame.text ?? "";
          setReasoning(r);
        } else if (frame.type === "error") {
          throw new StreamError(frame.text || "出错了，请重试");
        }
        // done 帧（及流自然结束）都走到下面 router.refresh()
      });
      router.refresh(); // 进入下一步（答追问 / 结果页），本组件随之卸载
    } catch (e) {
      setError(e instanceof StreamError ? e.message : "网络出错，请重试");
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
