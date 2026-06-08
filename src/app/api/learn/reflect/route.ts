// 提交章节反思作答 → AI 本章小结。流式把「思考过程」回给客户端；JSON 结果在后台解析落库，不外泄。
import { getCurrentUser } from "@/lib/auth/user";
import { submitReflection } from "@/lib/reflection";
import { reasoningStreamResponse } from "@/lib/ndjson";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: { chapterId?: unknown; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }
  const chapterId = String(body.chapterId ?? "");
  const answers = Array.isArray(body.answers) ? body.answers.map((a) => String(a)) : [];
  if (!chapterId) return new Response("缺少章节", { status: 400 });

  return reasoningStreamResponse(
    (onReasoning) => submitReflection(user.id, chapterId, answers, onReasoning),
    "提交失败，请重试",
  );
}
