// ===========================================================================
// src/lib/social.ts —— 社交与同伴可见性（PRD §9）。
// 防抄袭：只有自己完成某关键词后，才能看他人该词的笔记（按分数降序）。
// 公开排行榜：只展示靠前/完成者，不公开落后者低分。
// ===========================================================================

import { prisma } from "@/lib/db";
import { parseTags, stripSensitivePortrait } from "@/lib/memory-diff";

export interface PeerNote {
  name: string;
  score: number;
  note: string;
  /** 该笔记对应的追问与对方的回答（完整展示同伴是怎么答的）。 */
  followups: { question: string; answer: string }[];
}

/**
 * 他人该关键词的完整记录（笔记 + 追问与回答，按最佳分降序）。
 * 仅当当前用户【已完成】该关键词才返回，否则返回 null（不可见，防抄袭）。
 * 不含他人的 AI 反馈（那是针对个人的评价，不公开）。
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
    take: 3,
    include: {
      user: { select: { name: true } },
      bestSubmission: {
        select: {
          noteText: true,
          scoring: {
            select: {
              followups: {
                orderBy: { order: "asc" },
                select: { question: true, answer: true },
              },
            },
          },
        },
      },
    },
  });
  return peers.map((p) => ({
    name: p.user.name,
    score: p.bestFinalScore,
    note: p.bestSubmission?.noteText ?? "",
    followups: (p.bestSubmission?.scoring?.followups ?? []).map((f) => ({
      question: f.question,
      answer: f.answer ?? "",
    })),
  }));
}

/** 某关键词的全员统计（均分 / 完成人数 / 你超过多少人）。完成人数为 0 返回 null。 */
export async function getKeywordStat(
  keywordId: string,
  myScore: number,
): Promise<{ avg: number; count: number; beatPct: number } | null> {
  const [agg, lower] = await Promise.all([
    prisma.keywordProgress.aggregate({
      where: { keywordId, isCompleted: true },
      _avg: { bestFinalScore: true },
      _count: { _all: true },
    }),
    prisma.keywordProgress.count({
      where: { keywordId, isCompleted: true, bestFinalScore: { lt: myScore } },
    }),
  ]);
  const count = agg._count._all;
  if (count === 0) return null;
  return {
    avg: Math.round(agg._avg.bestFinalScore ?? 0),
    count,
    beatPct: Math.round((lower / count) * 100),
  };
}

export interface LeaderRow {
  userId: string;
  name: string;
  /** 排名依据：已通关词的「每词最高分」平均值（积分大家差不多，用质量区分）。 */
  avgScore: number;
  completed: number;
  /** 当前学科累计学习时长（分钟，仅展示，不参与排名）。 */
  learningMinutes: number;
  /** 当前学科积分（兑换用，仅展示，不参与排名）。 */
  points: number;
}

function minutesBetween(start: Date, end: Date, max: number): number {
  const minutes = Math.ceil((end.getTime() - start.getTime()) / 60000);
  return Math.max(1, Math.min(max, minutes));
}

async function getLearningMinutesByUser(subjectId: string, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const [submissions, reflections] = await Promise.all([
    prisma.submission.findMany({
      where: {
        userId: { in: userIds },
        status: "COMPLETED",
        keyword: { chapter: { subjectId } },
      },
      select: { userId: true, createdAt: true, updatedAt: true },
    }),
    prisma.chapterReflection.findMany({
      where: { userId: { in: userIds }, chapter: { subjectId }, summary: { not: "" } },
      select: { userId: true, createdAt: true, updatedAt: true },
    }),
  ]);
  const byUser = new Map<string, number>();
  for (const s of submissions) {
    byUser.set(s.userId, (byUser.get(s.userId) ?? 0) + minutesBetween(s.createdAt, s.updatedAt, 90));
  }
  for (const r of reflections) {
    byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + minutesBetween(r.createdAt, r.updatedAt, 60));
  }
  return byUser;
}

/** 学习榜：按「每词最高分的均分」降序，只取靠前的若干人（不公开落后者）。
 *  通关任意一个词即可上榜，**不要求章节反思**（反思只在「各章冠军」周结算时才作门槛，见 ranking.ts）。 */
export async function getLeaderboard(
  subjectId: string,
  limit = 10,
): Promise<LeaderRow[]> {
  const [byScore, byPoints, users] = await Promise.all([
    prisma.keywordProgress.groupBy({
      by: ["userId"],
      where: { subjectId, isCompleted: true },
      _avg: { bestFinalScore: true },
      _count: { _all: true },
    }),
    prisma.pointsLedger.groupBy({
      by: ["userId"],
      where: { subjectId },
      _sum: { amount: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const pointsOf = new Map(byPoints.map((p) => [p.userId, p._sum.amount ?? 0]));

  const ranked = byScore
    .map((s) => ({
      userId: s.userId,
      name: nameOf.get(s.userId) ?? "",
      avgScore: s._avg.bestFinalScore ?? 0,
      completed: s._count._all,
      learningMinutes: 0,
      points: pointsOf.get(s.userId) ?? 0,
    }))
    .filter((r) => r.completed > 0)
    .sort((a, b) => b.avgScore - a.avgScore || b.completed - a.completed)
    .slice(0, limit);
  const learningMinutesOf = await getLearningMinutesByUser(subjectId, ranked.map((r) => r.userId));
  return ranked.map((r) => ({
    ...r,
    learningMinutes: learningMinutesOf.get(r.userId) ?? 0,
  }));
}

export interface PointsLeader {
  userId: string;
  name: string;
  /** 累计获得 = 通关 + 排名奖励（跨学科，不受兑换影响）。 */
  earned: number;
  base: number;
  bonus: number;
}

/**
 * 积分总榜（全平台·跨学科）：按**累计获得**（BASE 通关 + RANK_BONUS 排名奖励之和）降序。
 * 不受兑换影响——花了分也不掉榜（荣誉榜，统一钱包，见 ADR-0001）。
 */
export async function getPointsLeaderboard(limit = 10): Promise<PointsLeader[]> {
  const [grouped, users] = await Promise.all([
    prisma.pointsLedger.groupBy({
      by: ["userId", "type"],
      where: { type: { in: ["BASE", "RANK_BONUS"] } },
      _sum: { amount: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const acc = new Map<string, { base: number; bonus: number }>();
  for (const g of grouped) {
    const cur = acc.get(g.userId) ?? { base: 0, bonus: 0 };
    if (g.type === "BASE") cur.base += g._sum.amount ?? 0;
    else cur.bonus += g._sum.amount ?? 0;
    acc.set(g.userId, cur);
  }
  return [...acc.entries()]
    .map(([userId, v]) => ({
      userId,
      name: nameOf.get(userId) ?? "",
      earned: v.base + v.bonus,
      base: v.base,
      bonus: v.bonus,
    }))
    .filter((r) => r.earned > 0)
    .sort((a, b) => b.earned - a.earned)
    .slice(0, limit);
}

export interface MyPointsStanding {
  /** 累计获得（跨学科）。 */
  earned: number;
  /** 在积分总榜里的名次（标准竞赛排名，并列同名次）；尚无积分为 null。 */
  rank: number | null;
  /** 总榜上榜人数（有积分者）。 */
  total: number;
}

/** 当前用户在积分总榜（累计获得）里的名次与积分——含未进 top10 的情况。 */
export async function getMyPointsRank(userId: string): Promise<MyPointsStanding> {
  const grouped = await prisma.pointsLedger.groupBy({
    by: ["userId"],
    where: { type: { in: ["BASE", "RANK_BONUS"] } },
    _sum: { amount: true },
  });
  const earners = grouped
    .map((g) => ({ userId: g.userId, earned: g._sum.amount ?? 0 }))
    .filter((e) => e.earned > 0);
  const mine = earners.find((e) => e.userId === userId)?.earned ?? 0;
  if (mine <= 0) return { earned: 0, rank: null, total: earners.length };
  const rank = 1 + earners.filter((e) => e.earned > mine).length; // 标准竞赛排名，并列同名次
  return { earned: mine, rank, total: earners.length };
}

export interface PeerRecordItem {
  keywordId: string;
  term: string;
  chapterIndex: number;
  score: number;
  /** 观看者是否也完成了该词（决定笔记/回答是否解锁，守防抄袭）。 */
  unlocked: boolean;
  note?: string;
  followups?: { question: string; answer: string }[];
}

/** 同伴当前画像（仅正向公开：强项 + 兴趣 + 隐去短板的画像；不含成长时间线）。 */
export interface PeerGrowthView {
  strengths: string[];
  interests: string[];
  /** 已剔除「待加强 / 盲区」小节的画像 Markdown。 */
  portrait: string;
}

export interface PeerRecordsView {
  name: string;
  totalCompleted: number;
  avgScore: number;
  points: number;
  learningMinutes: number;
  /** 观看者已解锁的词数（用于提示）。 */
  unlockedCount: number;
  items: PeerRecordItem[];
  /** 仅正向公开的成长轨迹；对方还没有画像时为 null。 */
  growth: PeerGrowthView | null;
}

/**
 * 某位排行榜成员的闯关记录（供观摩）。
 * 守防抄袭：每条笔记/回答仅当【观看者本人也完成了该词】才解锁，否则只给词名+分数。
 * 仅 top10 在榜成员可看（与 §9.2 公开身份一致）；否则返回 null。
 */
export async function getPeerRecords(
  viewerId: string,
  targetId: string,
  subjectId: string,
): Promise<PeerRecordsView | null> {
  const leaders = await getLeaderboard(subjectId, 10);
  const leader = leaders.find((l) => l.userId === targetId);
  if (!leader) return null; // 不在 top10 / 未公开，不可看

  const [target, progresses, viewerDone, memory] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetId }, select: { name: true } }),
    prisma.keywordProgress.findMany({
      where: { userId: targetId, subjectId, isCompleted: true, bestSubmissionId: { not: null } },
      orderBy: [{ chapterId: "asc" }, { bestFinalScore: "desc" }],
      include: {
        keyword: { include: { chapter: { select: { index: true } } } },
        bestSubmission: {
          select: {
            noteText: true,
            scoring: {
              select: {
                followups: {
                  orderBy: { order: "asc" },
                  select: { question: true, answer: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.keywordProgress.findMany({
      where: { userId: viewerId, subjectId, isCompleted: true },
      select: { keywordId: true },
    }),
    prisma.employeeMemory.findUnique({
      where: { userId: targetId },
      select: { tags: true, portrait: true, updateCount: true },
    }),
  ]);
  if (!target) return null;

  // 当前画像（仅正向公开）：强项 + 兴趣 + 隐去短板的画像；不含成长时间线
  const peerTags = parseTags(memory?.tags);
  const growth: PeerGrowthView | null =
    memory && memory.updateCount > 0
      ? {
          strengths: peerTags.strengths,
          interests: peerTags.interests,
          portrait: stripSensitivePortrait(memory.portrait ?? ""),
        }
      : null;

  const done = new Set(viewerDone.map((p) => p.keywordId));
  const items: PeerRecordItem[] = progresses.map((p) => {
    const unlocked = done.has(p.keywordId);
    return {
      keywordId: p.keywordId,
      term: p.keyword.term,
      chapterIndex: p.keyword.chapter.index,
      score: p.bestFinalScore,
      unlocked,
      note: unlocked ? (p.bestSubmission?.noteText ?? "") : undefined,
      followups: unlocked
        ? (p.bestSubmission?.scoring?.followups ?? []).map((f) => ({
            question: f.question,
            answer: f.answer ?? "",
          }))
        : undefined,
    };
  });

  return {
    name: target.name,
    totalCompleted: items.length,
    avgScore: leader.avgScore,
    points: leader.points,
    learningMinutes: leader.learningMinutes,
    unlockedCount: items.filter((i) => i.unlocked).length,
    items,
    growth,
  };
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
