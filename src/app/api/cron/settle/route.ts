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
import { getActiveSubjects } from "@/lib/subject";

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

  // 遍历所有「已上线」学科，各自按其当前周结算到期章节（一次性幂等，重复触发安全）
  const subjects = await getActiveSubjects();
  const settled: {
    subjectId: string;
    title: string;
    currentWeek: number;
    results: { chapter: number; ranked: number }[];
  }[] = [];

  for (const subject of subjects) {
    const { currentWeek } = getScheduleInfo(subject);
    if (currentWeek <= 0) continue; // 未开课的学科跳过

    const chapters = await prisma.chapter.findMany({
      where: { subjectId: subject.id, index: { lte: currentWeek } },
      orderBy: { index: "asc" },
    });
    const results: { chapter: number; ranked: number }[] = [];
    for (const ch of chapters) {
      const rows = await settleChapterWeek(subject.id, ch.id, ch.index);
      results.push({ chapter: ch.index, ranked: rows.length });
    }
    settled.push({ subjectId: subject.id, title: subject.title, currentWeek, results });
  }

  return NextResponse.json({ ok: true, subjects: settled });
}

export const POST = GET;
