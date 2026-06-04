// ===========================================================================
// src/lib/social.ts —— 社交与同伴可见性（PRD §9）。
// 防抄袭：只有自己完成某关键词后，才能看他人该词的笔记（按分数降序）。
// 公开排行榜：只展示靠前/完成者，不公开落后者低分。
// ===========================================================================

import { prisma } from "@/lib/db";

export interface PeerNote {
  name: string;
  score: number;
  note: string;
}

/**
 * 他人该关键词的笔记（按最佳分降序）。
 * 仅当当前用户【已完成】该关键词才返回，否则返回 null（不可见，防抄袭）。
 */
export async function getPeerNotes(
  userId: string,
  keywordId: string,
): Promise<PeerNote[] | null> {
  const me = await prisma.keywordProgress.findUnique({
    where: { userId_keywordId: { userId, keywordId } },
  });
  if (!me?.isCompleted) return null;

  const peers = await prisma.keywordProgress.findMany({
    where: {
      keywordId,
      isCompleted: true,
      userId: { not: userId },
      bestSubmissionId: { not: null },
    },
    orderBy: { bestFinalScore: "desc" },
    take: 10,
    include: {
      user: { select: { name: true } },
      bestSubmission: { select: { noteText: true } },
    },
  });
  return peers.map((p) => ({
    name: p.user.name,
    score: p.bestFinalScore,
    note: p.bestSubmission?.noteText ?? "",
  }));
}

export interface LeaderRow {
  userId: string;
  name: string;
  points: number;
  completed: number;
}

/** 积分榜：按当前学科积分降序，只取靠前的若干人（不公开落后者）。 */
export async function getLeaderboard(
  subjectId: string,
  limit = 10,
): Promise<LeaderRow[]> {
  const [byPoints, byCompleted, users] = await Promise.all([
    prisma.pointsLedger.groupBy({
      by: ["userId"],
      where: { subjectId },
      _sum: { amount: true },
    }),
    prisma.keywordProgress.groupBy({
      by: ["userId"],
      where: { subjectId, isCompleted: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const completedOf = new Map(byCompleted.map((c) => [c.userId, c._count._all]));

  return byPoints
    .map((p) => ({
      userId: p.userId,
      name: nameOf.get(p.userId) ?? "",
      points: p._sum.amount ?? 0,
      completed: completedOf.get(p.userId) ?? 0,
    }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || b.completed - a.completed)
    .slice(0, limit);
}

export interface ChapterWinner {
  chapterIndex: number;
  chapterTitle: string;
  winners: { name: string; rank: number; avgScore: number }[];
}

/** 各章 top3 获奖名单（来自已结算的 RankingResult）。 */
export async function getChapterWinners(subjectId: string): Promise<ChapterWinner[]> {
  const results = await prisma.rankingResult.findMany({
    where: { subjectId, rank: { lte: 3 } },
    orderBy: [{ chapterId: "asc" }, { rank: "asc" }],
    include: {
      user: { select: { name: true } },
      chapter: { select: { index: true, title: true } },
    },
  });
  const byChapter = new Map<number, ChapterWinner>();
  for (const r of results) {
    const idx = r.chapter.index;
    if (!byChapter.has(idx)) {
      byChapter.set(idx, { chapterIndex: idx, chapterTitle: r.chapter.title, winners: [] });
    }
    byChapter.get(idx)!.winners.push({
      name: r.user.name,
      rank: r.rank,
      avgScore: r.avgScore,
    });
  }
  return [...byChapter.values()].sort((a, b) => a.chapterIndex - b.chapterIndex);
}
