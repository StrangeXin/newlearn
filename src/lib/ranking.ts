// ===========================================================================
// src/lib/ranking.ts —— 周排名结算（PRD §7.2）。
// 仅完成该章全部关键词者入排名；按 20 词最终分均值排序；标准竞赛排名(并列同名次)，
// 前 3 名各 +100 积分；并列均给、不稀释。
//
// 一致性（对抗式审查后加固）：结算是「一次性快照」——首次结算即权威，写入后
// 不再改写 avgScore/rank/奖励。整段在一个事务 + (subject,chapter,week) advisory 锁内完成，
// 重复/并发结算直接返回现有结果，杜绝「重提刷分追溯改写已发奖、跌出 top3 仍留奖」的账实不符。
// ===========================================================================

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { weekStartOf } from "@/lib/schedule";
import { RANK_BONUS_POINTS, writeLedgerTx } from "@/lib/ledger";

export interface RankRow {
  userId: string;
  name: string;
  avgScore: number;
  rank: number;
  bonusAwarded: boolean;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 第 weekIndex 周的周一 00:00 与周日末（按本地日历推算，避开 DST 毫秒漂移）。 */
function weekRange(startDate: Date, weekIndex: number): { start: Date; end: Date } {
  const start = weekStartOf(addDays(weekStartOf(startDate), (weekIndex - 1) * 7));
  const end = new Date(addDays(start, 7).getTime() - 1000);
  return { start, end };
}

async function readRanking(
  client: Prisma.TransactionClient,
  subjectId: string,
  chapterId: string,
  weekIndex: number,
): Promise<RankRow[]> {
  const results = await client.rankingResult.findMany({
    where: { subjectId, chapterId, weekIndex },
    orderBy: [{ rank: "asc" }, { avgScore: "desc" }],
    include: { user: { select: { name: true } } },
  });
  return results.map((r) => ({
    userId: r.userId,
    name: r.user.name,
    avgScore: r.avgScore,
    rank: r.rank,
    bonusAwarded: r.bonusAwarded,
  }));
}

/**
 * 结算某章某周排名（一次性快照，幂等）。首次结算写入并发放 top3 奖励；
 * 已结算（存在任一 RankingResult）则原样返回，不改写、不重发。
 */
export async function settleChapterWeek(
  subjectId: string,
  chapterId: string,
  weekIndex: number,
): Promise<RankRow[]> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject?.startDate) throw new Error("学科未设开始日，无法结算");
  const { start: weekStartDate, end: weekEnd } = weekRange(subject.startDate, weekIndex);

  return prisma.$transaction(
    async (tx) => {
      // 串行化同章同周的结算
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rank:${subjectId}:${chapterId}:${weekIndex}`}))`;

      // 一次性：已结算则原样返回
      const already = await tx.rankingResult.count({ where: { subjectId, chapterId, weekIndex } });
      if (already > 0) return readRanking(tx, subjectId, chapterId, weekIndex);

      const keywordCount = await tx.keyword.count({ where: { chapterId } });
      if (keywordCount === 0) return [];

      // 截至本周末完成该章全部关键词者，按 bestFinalScore 均值（结算时刻快照）
      const grouped = await tx.keywordProgress.groupBy({
        by: ["userId"],
        where: { chapterId, isCompleted: true, completedAt: { lte: weekEnd } },
        _count: { _all: true },
        _avg: { bestFinalScore: true },
      });
      // 入选门槛还要求「该章反思已完成」（截至本周末）——只有 20 词全过且已反思才参与排名
      const reflected = await tx.chapterReflection.findMany({
        where: { chapterId, summary: { not: "" }, updatedAt: { lte: weekEnd } },
        select: { userId: true },
      });
      const reflectedSet = new Set(reflected.map((r) => r.userId));
      const eligible = grouped
        .filter(
          (g) =>
            g._count._all === keywordCount &&
            g._avg.bestFinalScore != null &&
            reflectedSet.has(g.userId),
        )
        .map((g) => ({ userId: g.userId, avg: g._avg.bestFinalScore as number }))
        .sort((a, b) => b.avg - a.avg);

      for (const e of eligible) {
        const rank = 1 + eligible.filter((o) => o.avg > e.avg).length; // 标准竞赛排名，并列同名次
        const awarded = rank <= 3;
        const rr = await tx.rankingResult.create({
          data: {
            subjectId,
            chapterId,
            weekIndex,
            weekStartDate,
            userId: e.userId,
            avgScore: e.avg,
            rank,
            bonusAwarded: awarded,
            bonusPoints: awarded ? RANK_BONUS_POINTS : 0,
            settledAt: new Date(),
          },
        });
        if (awarded) {
          await writeLedgerTx(tx, {
            type: "RANK_BONUS",
            userId: e.userId,
            subjectId,
            rankingResultId: rr.id,
            weekIndex,
            rank,
          });
        }
      }
      return readRanking(tx, subjectId, chapterId, weekIndex);
    },
    { timeout: 20000 },
  );
}

/** 读取某章某周已结算的排名（用于展示）。 */
export async function getChapterRanking(
  subjectId: string,
  chapterId: string,
  weekIndex: number,
): Promise<RankRow[]> {
  return readRanking(prisma, subjectId, chapterId, weekIndex);
}
