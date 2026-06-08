// ===========================================================================
// src/lib/stats.ts —— 管理后台统计聚合（PRD §9.3）。
// 进度总览 / 质量分析 / 积分与兑换财务 / 全员学情花名册与逐人 360°。
// ===========================================================================

import { prisma } from "@/lib/db";
import { parseTags } from "@/lib/memory-diff";
import { getScheduleInfo } from "@/lib/schedule";
import type { LearnerMemoryTags } from "@/lib/scoring";
import { getActiveSubjects } from "@/lib/subject";

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

// 统一钱包：兑换为账号级，财务口径全公司汇总（赚分仍可按学科看，但花费/余额跨学科）。
export async function getFinanceStats(): Promise<FinanceStats> {
  const [earn, redeem, pending, approved] = await Promise.all([
    prisma.pointsLedger.aggregate({
      where: { type: { in: ["BASE", "RANK_BONUS"] } },
      _sum: { amount: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { type: "REDEEM" },
      _sum: { amount: true },
    }),
    prisma.redemption.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.redemption.count({ where: { status: "APPROVED" } }),
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

// ===========================================================================
// 全员学情（PRD §9.3 增补）：花名册（按学科）+ 逐人 360°（跨学科、不脱敏）。
// 仅管理后台使用；与同伴可见性（social.ts 脱敏/门禁）是两条独立路径。
// ===========================================================================

export type LearnerStatus = "inactive" | "notStarted" | "learning" | "completed";

export interface LearnerRosterRow {
  userId: string;
  name: string;
  /** 部门（来自 onboarding 资料；未填为空串）。 */
  department: string;
  /** 本学科已通过关键词数。 */
  completed: number;
  /** 本学科已通过词的最高分均值（保留一位小数）。 */
  avgScore: number;
  /** 本学科积分余额（含基础+排名−兑换）。 */
  points: number;
  isActivated: boolean;
  /** 本学科最近一次完成提交时间（判断是否卡住）。 */
  lastActiveAt: Date | null;
  status: LearnerStatus;
  /** 是否落后：已激活但完成数低于「当前周之前各章本应学完」的线。 */
  behind: boolean;
}

export interface LearnerRoster {
  totalKeywords: number;
  currentWeek: number;
  rows: LearnerRosterRow[];
}

/** 某学科的全员学情花名册（逐人一行，列表渲染；搜索/筛选/排序在客户端做）。 */
export async function getLearnerRoster(subjectId: string): Promise<LearnerRoster> {
  const [subject, totalKeywords, chaptersCount, employees, progress, points, activity] =
    await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId }, select: { startDate: true } }),
      prisma.keyword.count({ where: { chapter: { subjectId } } }),
      prisma.chapter.count({ where: { subjectId } }),
      prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        select: {
          id: true,
          name: true,
          isActivated: true,
          profile: { select: { department: true } },
        },
      }),
      prisma.keywordProgress.groupBy({
        by: ["userId"],
        where: { subjectId, isCompleted: true },
        _count: { _all: true },
        _avg: { bestFinalScore: true },
      }),
      prisma.pointsLedger.groupBy({ by: ["userId"], where: { subjectId }, _sum: { amount: true } }),
      prisma.submission.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED", keyword: { chapter: { subjectId } } },
        _max: { updatedAt: true },
      }),
    ]);

  const doneOf = new Map(progress.map((g) => [g.userId, g._count._all]));
  const avgOf = new Map(progress.map((g) => [g.userId, g._avg.bestFinalScore ?? 0]));
  const pointsOf = new Map(points.map((p) => [p.userId, p._sum.amount ?? 0]));
  const activeOf = new Map(activity.map((a) => [a.userId, a._max.updatedAt ?? null]));

  const currentWeek = getScheduleInfo(subject).currentWeek;
  // 落后线：当前周之前的章节都本应学完（每章 20 词），低于此线即落后。
  const expectedDoneChapters = Math.min(Math.max(0, currentWeek - 1), chaptersCount);
  const behindThreshold = expectedDoneChapters * 20;

  const rows: LearnerRosterRow[] = employees.map((e) => {
    const completed = doneOf.get(e.id) ?? 0;
    const status: LearnerStatus = !e.isActivated
      ? "inactive"
      : totalKeywords > 0 && completed >= totalKeywords
        ? "completed"
        : completed === 0
          ? "notStarted"
          : "learning";
    return {
      userId: e.id,
      name: e.name,
      department: e.profile?.department ?? "",
      completed,
      avgScore: Math.round((avgOf.get(e.id) ?? 0) * 10) / 10,
      points: pointsOf.get(e.id) ?? 0,
      isActivated: e.isActivated,
      lastActiveAt: activeOf.get(e.id) ?? null,
      status,
      behind: e.isActivated && behindThreshold > 0 && completed < behindThreshold,
    };
  });
  rows.sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name, "zh"));
  return { totalKeywords, currentWeek, rows };
}

export interface LearnerProfileView {
  position: string;
  department: string;
  level: string;
  background: string;
  aiFamiliarity: string;
  applicationAreas: string;
}

export interface LearnerSubjectProgress {
  subjectId: string;
  title: string;
  completed: number;
  total: number;
  avgScore: number;
  points: number;
}

export interface LearnerRecord {
  keywordId: string;
  term: string;
  subjectId: string;
  subjectTitle: string;
  chapterIndex: number;
  score: number;
  note: string;
  feedback: string;
  followups: { question: string; answer: string }[];
}

export interface LearnerDetail {
  userId: string;
  name: string;
  isActivated: boolean;
  /** 账号钱包（统一钱包，跨学科）：累计获得 / 已兑换 / 当前余额。 */
  wallet: { earned: number; redeemed: number; balance: number };
  profile: LearnerProfileView | null;
  /** 完整画像（不脱敏，含待加强/盲区）；从未建立画像为 null。 */
  memory: { tags: LearnerMemoryTags; portrait: string; updateCount: number } | null;
  snapshots: {
    id: string;
    seq: number;
    finalScore: number;
    keywordTerm: string;
    createdAt: Date;
    diff: unknown;
  }[];
  subjects: LearnerSubjectProgress[];
  records: LearnerRecord[];
}

/** 某员工的逐人 360°：跨学科进度 + 完整画像 + 成长轨迹 + 逐词答题记录（管理视图，不脱敏）。 */
export async function getLearnerDetail(userId: string): Promise<LearnerDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isActivated: true, profile: true },
  });
  if (!user) return null;

  const [subjects, memory, snapshots, progresses, perSubjectAgg, perSubjectPoints, ledgerByType] =
    await Promise.all([
      getActiveSubjects(),
      prisma.employeeMemory.findUnique({
        where: { userId },
        select: { tags: true, portrait: true, updateCount: true },
      }),
      prisma.employeeMemorySnapshot.findMany({ where: { userId }, orderBy: { seq: "asc" } }),
      prisma.keywordProgress.findMany({
        where: { userId, isCompleted: true, bestSubmissionId: { not: null } },
        orderBy: [{ subjectId: "asc" }, { chapterId: "asc" }, { bestFinalScore: "desc" }],
        include: {
          keyword: {
            include: {
              chapter: { select: { index: true, subjectId: true, subject: { select: { title: true } } } },
            },
          },
          bestSubmission: {
            select: {
              noteText: true,
              scoring: {
                select: {
                  feedback: true,
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
      prisma.keywordProgress.groupBy({
        by: ["subjectId"],
        where: { userId, isCompleted: true },
        _count: { _all: true },
        _avg: { bestFinalScore: true },
      }),
      prisma.pointsLedger.groupBy({ by: ["subjectId"], where: { userId }, _sum: { amount: true } }),
      prisma.pointsLedger.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } }),
    ]);

  // 账号钱包（统一钱包）：累计获得 = BASE + RANK_BONUS；已兑换 = REDEEM 取正。
  const sumOfType = (t: string) =>
    ledgerByType.filter((g) => g.type === t).reduce((s, g) => s + (g._sum.amount ?? 0), 0);
  const earned = sumOfType("BASE") + sumOfType("RANK_BONUS");
  const redeemed = -sumOfType("REDEEM");
  const wallet = { earned, redeemed, balance: earned - redeemed };

  const subjectTotals = await Promise.all(
    subjects.map((s) => prisma.keyword.count({ where: { chapter: { subjectId: s.id } } })),
  );
  const doneBySubject = new Map(perSubjectAgg.map((g) => [g.subjectId, g._count._all]));
  const avgBySubject = new Map(perSubjectAgg.map((g) => [g.subjectId, g._avg.bestFinalScore ?? 0]));
  const pointsBySubject = new Map(perSubjectPoints.map((p) => [p.subjectId, p._sum.amount ?? 0]));

  const subjectsProgress: LearnerSubjectProgress[] = subjects.map((s, i) => ({
    subjectId: s.id,
    title: s.title,
    completed: doneBySubject.get(s.id) ?? 0,
    total: subjectTotals[i],
    avgScore: Math.round((avgBySubject.get(s.id) ?? 0) * 10) / 10,
    points: pointsBySubject.get(s.id) ?? 0,
  }));

  const records: LearnerRecord[] = progresses.map((p) => ({
    keywordId: p.keywordId,
    term: p.keyword.term,
    subjectId: p.keyword.chapter.subjectId,
    subjectTitle: p.keyword.chapter.subject.title,
    chapterIndex: p.keyword.chapter.index,
    score: p.bestFinalScore,
    note: p.bestSubmission?.noteText ?? "",
    feedback: p.bestSubmission?.scoring?.feedback ?? "",
    followups: (p.bestSubmission?.scoring?.followups ?? []).map((f) => ({
      question: f.question,
      answer: f.answer ?? "",
    })),
  }));

  return {
    userId: user.id,
    name: user.name,
    isActivated: user.isActivated,
    wallet,
    profile: user.profile
      ? {
          position: user.profile.position,
          department: user.profile.department,
          level: user.profile.level,
          background: user.profile.background,
          aiFamiliarity: user.profile.aiFamiliarity,
          applicationAreas: user.profile.applicationAreas,
        }
      : null,
    memory: memory
      ? { tags: parseTags(memory.tags), portrait: memory.portrait ?? "", updateCount: memory.updateCount }
      : null,
    snapshots,
    subjects: subjectsProgress,
    records,
  };
}
