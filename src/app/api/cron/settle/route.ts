// ===========================================================================
// /api/cron/settle —— 周结算定时任务（PRD §7.4 生产）。
// 解锁是按 startDate 自动计算的，无需任务；这里只把「已到期」的章节排名结算掉。
// 由 Vercel Cron（自动带 Authorization: Bearer $CRON_SECRET）或系统 cron（?key=）触发。
// settleChapterWeek 是一次性幂等快照结算，重复触发安全。
// ===========================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getScheduleInfo } from "@/lib/schedule";
import { settleChapterWeek } from "@/lib/ranking";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET 未配置" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  if (!cfg?.activeSubjectId) return NextResponse.json({ ok: true, settled: 0 });

  const subject = await prisma.subject.findUnique({ where: { id: cfg.activeSubjectId } });
  const { currentWeek } = getScheduleInfo(subject);

  // 结算所有「周次已到」的章节（index <= 当前周）；一次性幂等，已结算的不会重复发奖
  const chapters = await prisma.chapter.findMany({
    where: { subjectId: cfg.activeSubjectId, index: { lte: currentWeek } },
    orderBy: { index: "asc" },
  });

  const results: { chapter: number; ranked: number }[] = [];
  for (const ch of chapters) {
    const rows = await settleChapterWeek(cfg.activeSubjectId, ch.id, ch.index);
    results.push({ chapter: ch.index, ranked: rows.length });
  }

  return NextResponse.json({ ok: true, currentWeek, results });
}

export const POST = GET;
