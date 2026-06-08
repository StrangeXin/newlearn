// 结果页「向 AI 追问」的流式接口：校验后把 streamAnswer 的增量逐帧以 NDJSON 流回客户端。
import { getCurrentUser } from "@/lib/auth/user";
import { prepareAsk, streamAnswer, type AskContext } from "@/lib/learn";
import { chunkStreamResponse } from "@/lib/ndjson";

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

  return chunkStreamResponse(streamAnswer(ctx));
}
