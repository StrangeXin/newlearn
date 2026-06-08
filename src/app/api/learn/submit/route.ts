// 提交笔记 → 初评 + 追问。流式把「思考过程」回给客户端；JSON 结果在后台解析落库，不外泄。
import { getCurrentUser } from "@/lib/auth/user";
import { startAttempt } from "@/lib/learn";
import { reasoningStreamResponse } from "@/lib/ndjson";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: { keywordId?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }
  const keywordId = String(body.keywordId ?? "");
  const note = String(body.note ?? "");
  if (!keywordId) return new Response("缺少关键词", { status: 400 });

  return reasoningStreamResponse(
    (onReasoning) => startAttempt(user.id, keywordId, note, onReasoning),
    "提交失败，请重试",
  );
}
