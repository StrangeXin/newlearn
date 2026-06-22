import { getCurrentUser } from "@/lib/auth/user";
import { requestRedemption } from "@/lib/redemption";
import type { RedemptionCategory } from "@/generated/prisma/client";

export const runtime = "nodejs";

const CATEGORIES = ["BOOK", "TOOL", "COURSE", "OTHER"] as const;

function parseCategory(value: unknown): RedemptionCategory {
  const raw = String(value ?? "");
  return (CATEGORIES as readonly string[]).includes(raw) ? (raw as RedemptionCategory) : "OTHER";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("未登录", { status: 401 });

  let body: { kind?: unknown; item?: unknown; amount?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体无效", { status: 400 });
  }

  if (body.kind === "createReminderDraft") {
    return new Response("后台自动任务尚未启用，请等待后续版本", { status: 400 });
  }
  if (body.kind !== "requestRedemption") {
    return new Response("不支持的确认动作", { status: 400 });
  }
  try {
    await requestRedemption(
      user.id,
      String(body.item ?? ""),
      Number(body.amount ?? 0),
      parseCategory(body.category),
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "提交失败", { status: 400 });
  }
  return Response.json({ ok: true });
}
