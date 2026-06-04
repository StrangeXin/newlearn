// ===========================================================================
// src/lib/stats.ts —— 管理后台统计聚合（PRD §9.3）。
// 进度总览 / 质量分析 / 积分与兑换财务。
// ===========================================================================

import { prisma } from "@/lib/db";

export interface ProgressRow {
  userId: string;
  name: string;
  completed: number;
}

export async function getProgressOverview(subjectId: string): Promise<{
  totalKeywords: number;
  rows: ProgressRow[];
}> {
  const [totalKeywords, employees, grouped] = await Promise.all([
    prisma.keyword.count({ where: { chapter: { subjectId } } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, select: { id: true, name: true } }),
    prisma.keywordProgress.groupBy({
      by: ["userId"],
      where: { subjectId, isCompleted: true },
      _count: { _all: true },
    }),
  ]);
  const doneOf = new Map(grouped.map((g) => [g.userId, g._count._all]));
  const rows = employees
    .map((e) => ({ userId: e.id, name: e.name, completed: doneOf.get(e.id) ?? 0 }))
    .sort((a, b) => b.completed - a.completed);
  return { totalKeywords, rows };
}

export interface QualityStats {
  avgScore: number;
  completedCount: number;
  hardest: { term: string; avg: number; count: number }[];
  distribution: { label: string; count: number }[];
}

export async function getQualityStats(subjectId: string): Promise<QualityStats> {
  const [agg, byKeyword] = await Promise.all([
    prisma.keywordProgress.aggregate({
      where: { subjectId, isCompleted: true },
      _avg: { bestFinalScore: true },
      _count: { _all: true },
    }),
    prisma.keywordProgress.groupBy({
      by: ["keywordId"],
      where: { subjectId, isCompleted: true },
      _avg: { bestFinalScore: true },
      _count: { _all: true },
    }),
  ]);

  const sorted = byKeyword
    .map((g) => ({ keywordId: g.keywordId, avg: g._avg.bestFinalScore ?? 0, count: g._count._all }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);
  const terms = await prisma.keyword.findMany({
    where: { id: { in: sorted.map((s) => s.keywordId) } },
    select: { id: true, term: true },
  });
  const termOf = new Map(terms.map((t) => [t.id, t.term]));
  const hardest = sorted.map((s) => ({
    term: termOf.get(s.keywordId) ?? "",
    avg: Math.round(s.avg),
    count: s.count,
  }));

  const buckets = [
    { label: "60-69", min: 60, max: 69 },
    { label: "70-79", min: 70, max: 79 },
    { label: "80-89", min: 80, max: 89 },
    { label: "90-100", min: 90, max: 100 },
  ];
  const distribution = await Promise.all(
    buckets.map(async (b) => ({
      label: b.label,
      count: await prisma.keywordProgress.count({
        where: { subjectId, isCompleted: true, bestFinalScore: { gte: b.min, lte: b.max } },
      }),
    })),
  );

  return {
    avgScore: Math.round(agg._avg.bestFinalScore ?? 0),
    completedCount: agg._count._all,
    hardest,
    distribution,
  };
}

export interface FinanceStats {
  issued: number;
  redeemed: number;
  balance: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
}

export async function getFinanceStats(subjectId: string): Promise<FinanceStats> {
  const [earn, redeem, pending, approved] = await Promise.all([
    prisma.pointsLedger.aggregate({
      where: { subjectId, type: { in: ["BASE", "RANK_BONUS"] } },
      _sum: { amount: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { subjectId, type: "REDEEM" },
      _sum: { amount: true },
    }),
    prisma.redemption.aggregate({
      where: { subjectId, status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.redemption.count({ where: { subjectId, status: "APPROVED" } }),
  ]);
  const issued = earn._sum.amount ?? 0;
  const redeemed = -(redeem._sum.amount ?? 0); // REDEEM 为负
  return {
    issued,
    redeemed,
    balance: issued - redeemed,
    pendingCount: pending._count._all,
    pendingAmount: pending._sum.amount ?? 0,
    approvedCount: approved,
  };
}
