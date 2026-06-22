import { getCurrentUser } from "@/lib/auth/user";
import { runAssistant } from "@/lib/assistant/agent";
import { streamFramesResponse } from "@/lib/ndjson";
import type { AssistantPageContext } from "@/lib/assistant/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: {
    message?: unknown;
    page?: AssistantPageContext;
    conversationId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }

  const message = String(body.message ?? "");
  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : undefined;

  return streamFramesResponse(
    runAssistant({
      user: { id: user.id, name: user.name, role: user.role },
      message,
      page: body.page ?? {},
      conversationId,
    }),
  );
}
