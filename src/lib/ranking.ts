// ===========================================================================
// src/lib/ranking.ts —— 周排名结算（PRD §7.2）。
// 仅完成该章全部关键词者入排名；按 20 词最终分均值排序；标准竞赛排名(并列同名次)，
// 前 3 名各 +100 积分；并列均给、不稀释。幂等：RankingResult 唯一 +
// RANK_BONUS 流水按 rankingResultId 唯一。
// ===========================================================================

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { weekStartOf } from "@/lib/schedule";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BONUS = 100;

export interface RankRow {
  userId: string;
  name: string;
  avgScore: number;
  rank: number;
  bonusAwarded: boolean;
}

/** 第 weekIndex 周的周一与周日末（基于学科开始日）。 */
function weekRange(startDate: Date, weekIndex: number): { start: Date; end: Date } {
  const base = weekStartOf(startDate).getTime() + (weekIndex - 1) * WEEK_MS;
  return { start: new Date(base), end: new Date(base + WEEK_MS - 1000) };
}

/**
 * 结算某章某周排名。返回排名行（已落 RankingResult 并发放 top3 奖励）。
 * 可重复调用：不会重复发奖。
 */
export async function settleChapterWeek(
  subjectId: string,
  chapterId: string,
  weekIndex: number,
): Promise<RankRow[]> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject?.startDate) throw new Error("学科未设开始日，无法结算");
  const { start: weekStartDate, end: weekEnd } = weekRange(subject.startDate, weekIndex);

  const keywordCount = await prisma.keyword.count({ where: { chapterId } });
  if (keywordCount === 0) return [];

  // 截至本周末、完成该章全部关键词的员工（按 bestFinalScore 求均值）
  const grouped = await prisma.keywordProgress.groupBy({
    by: ["userId"],
    where: { chapterId, isCompleted: true, completedAt: { lte: weekEnd } },
    _count: { _all: true },
    _avg: { bestFinalScore: true },
  });
  const eligible = grouped
    .filter((g) => g._count._all === keywordCount && g._avg.bestFinalScore != null)
    .map((g) => ({ userId: g.userId, avg: g._avg.bestFinalScore as number }))
    .sort((a, b) => b.avg - a.avg);

  const rows: RankRow[] = [];
  for (const e of eligible) {
    // 标准竞赛排名：严格高于者数 + 1（并列同名次）
    const rank = 1 + eligible.filter((o) => o.avg > e.avg).length;

    const rr = await prisma.rankingResult.upsert({
      where: {
        subjectId_chapterId_weekIndex_userId: {
          subjectId,
          chapterId,
          weekIndex,
          userId: e.userId,
        },
      },
      create: {
        subjectId,
        chapterId,
        weekIndex,
        weekStartDate,
        userId: e.userId,
        avgScore: e.avg,
        rank,
        settledAt: new Date(),
      },
      update: { avgScore: e.avg, rank, settledAt: new Date() },
    });

    let bonusAwarded = rr.bonusAwarded;
    if (rank <= 3 && !rr.bonusAwarded) {
      try {
        await prisma.pointsLedger.create({
          data: {
            userId: e.userId,
            subjectId,
            type: "RANK_BONUS",
            amount: BONUS,
            rankingResultId: rr.id,
            memo: `第${weekIndex}周排名奖励（第${rank}名）`,
          },
        });
        await prisma.rankingResult.update({
          where: { id: rr.id },
          data: { bonusAwarded: true, bonusPoints: BONUS },
        });
        bonusAwarded = true;
      } catch (err) {
        // 幂等兜底：已发过(唯一冲突)忽略，其它错误抛出
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
        bonusAwarded = true;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: e.userId },
      select: { name: true },
    });
    rows.push({ userId: e.userId, name: user?.name ?? "", avgScore: e.avg, rank, bonusAwarded });
  }
  return rows.sort((a, b) => a.rank - b.rank || b.avgScore - a.avgScore);
}

/** 读取某章某周已结算的排名（用于展示）。 */
export async function getChapterRanking(
  subjectId: string,
  chapterId: string,
  weekIndex: number,
): Promise<RankRow[]> {
  const results = await prisma.rankingResult.findMany({
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
