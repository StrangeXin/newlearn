// 提交追问回答 → 终评。流式把「思考过程」回给客户端；JSON 结果在后台解析落库，不外泄。
import { getCurrentUser } from "@/lib/auth/user";
import { completeAttempt } from "@/lib/learn";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: { submissionId?: unknown; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }
  const submissionId = String(body.submissionId ?? "");
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => String(a)) : [];
  if (!submissionId) return new Response("缺少提交标识", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        await completeAttempt(user.id, submissionId, answers, (text) =>
          send({ type: "reasoning", text }),
        );
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", text: e instanceof Error ? e.message : "评分失败，请重试" });
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
