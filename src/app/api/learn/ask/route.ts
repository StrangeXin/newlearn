// 结果页「向 AI 追问」的流式接口：校验后用 SSE 从 DeepSeek 取增量，逐段以纯文本流回客户端。
import { getCurrentUser } from "@/lib/auth/user";
import { prepareAsk, streamAnswer, type AskContext } from "@/lib/learn";

// 流式 + Prisma + AsyncLocalStorage 需要 Node 运行时
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: { submissionId?: unknown; question?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }
  const submissionId = String(body.submissionId ?? "");
  const question = String(body.question ?? "");

  let ctx: AskContext;
  try {
    ctx = await prepareAsk(user.id, submissionId, question);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "提问失败", { status: 400 });
  }

  // NDJSON：每行一个 {type:"reasoning"|"answer", text} 增量，便于客户端区分思考过程与正文
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const chunk of streamAnswer(ctx)) send(chunk);
      } catch (e) {
        send({ type: "answer", text: `\n\n（回答中断：${e instanceof Error ? e.message : "出错了"}）` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
