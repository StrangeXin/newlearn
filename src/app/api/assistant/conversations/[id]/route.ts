import { getCurrentUser } from "@/lib/auth/user";
import { getAssistantMessages } from "@/lib/assistant/agent";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  const { id } = await params;
  const data = await getAssistantMessages(user.id, id);
  if (!data.conversationId) return new Response("对话不存在", { status: 404 });
  return Response.json(data);
}
