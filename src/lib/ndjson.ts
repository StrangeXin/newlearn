// ===========================================================================
// src/lib/ndjson.ts —— 流式打分/追问的 NDJSON 线协议（服务端编码）。
// 每行一个 JSON 帧：{type:"reasoning"|"answer"|"done"|"error", text?}。
// 与客户端 consumeNdjson / useReasoningStream（src/components/thinking.tsx）一一对应。
// 所有流式路由（submit/finalize/reflect/ask）共用本模块——wire 格式只此一处。
// ===========================================================================

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
} as const;

/** NDJSON 流式响应骨架：建 ReadableStream + 头，把逐行 send 交给 body，结束自动 close。 */
function ndjsonResponse(body: (send: (frame: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(frame) + "\n"));
      try {
        await body(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}

/** 通用 NDJSON 响应：给 Agent 等非评分流式接口复用。 */
export function streamFramesResponse(frames: AsyncIterable<unknown>): Response {
  return ndjsonResponse(async (send) => {
    try {
      for await (const frame of frames) send(frame);
    } catch (e) {
      send({ type: "error", text: e instanceof Error ? e.message : "流式响应失败" });
    }
  });
}

/**
 * 「流式打分」响应（submit / finalize / reflect 共用）：
 * 逐行回 reasoning 帧，成功收尾回 done，出错回 error 帧。与客户端 useReasoningStream 对应。
 */
export function reasoningStreamResponse(
  run: (onReasoning: (text: string) => void) => Promise<unknown>,
  fallbackError: string,
): Response {
  return ndjsonResponse(async (send) => {
    try {
      await run((text) => send({ type: "reasoning", text }));
      send({ type: "done" });
    } catch (e) {
      send({ type: "error", text: e instanceof Error ? e.message : fallbackError });
    }
  });
}

/**
 * 「流式追问」响应（结果页向 AI 追问）：把增量 chunk 异步迭代器逐帧下发；
 * 生成中断时补一段 answer 帧说明，前端无需特判 error。
 */
export function chunkStreamResponse(
  chunks: AsyncIterable<{ type: "reasoning" | "answer"; text: string }>,
): Response {
  return ndjsonResponse(async (send) => {
    try {
      for await (const chunk of chunks) send(chunk);
    } catch (e) {
      send({
        type: "answer",
        text: `\n\n（回答中断：${e instanceof Error ? e.message : "出错了"}）`,
      });
    }
  });
}
