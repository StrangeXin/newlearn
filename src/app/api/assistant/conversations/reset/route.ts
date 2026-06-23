import { getCurrentUser } from "@/lib/auth/user";
import { createAssistantConversation } from "@/lib/assistant/agent";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  return Response.json(await createAssistantConversation(user.id));
}
