import { getCurrentUser } from "@/lib/auth/user";
import { getRecentAssistantMessages } from "@/lib/assistant/agent";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });
  const data = await getRecentAssistantMessages(user.id);
  return Response.json(data);
}
