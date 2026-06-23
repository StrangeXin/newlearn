import { getCurrentUser } from "@/lib/auth/user";
import { createAssistantConversation, listAssistantConversations } from "@/lib/assistant/agent";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  return Response.json({ conversations: await listAssistantConversations(user.id) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  return Response.json(await createAssistantConversation(user.id));
}
