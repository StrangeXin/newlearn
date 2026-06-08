import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { settleChapterWeek } from "@/lib/ranking";

// 周结算的深逻辑（资格门槛 / 并列 / 标准竞赛名次 / 一次性快照幂等）此前零测试。
// 用独立学科（isActive=false，不污染演示数据）+ 真 DB 直接驱动 settleChapterWeek。
const TAG = "__itest_settle__";
const json = (v: unknown) => v as Prisma.InputJsonValue;

let subjectId = "";
let chapterId = "";
let keywordIds: string[] = [];
const users: Record<string, string> = {};

async function mkUser(key: string): Promise<string> {
  const u = await prisma.user.create({
    data: { loginName: `${TAG}-${key}`, name: `${TAG}-${key}`, passwordHash: "x", role: "EMPLOYEE" },
  });
  users[key] = u.id;
  return u.id;
}

/** 让某用户完成本章前 completeCount 个关键词（各给定分），可选做章节反思。 */
async function setup(
  key: string,
  scores: number[],
  withReflection: boolean,
  completeCount = keywordIds.length,
): Promise<void> {
  const userId = await mkUser(key);
  for (let i = 0; i < completeCount; i += 1) {
    await prisma.keywordProgress.create({
      data: {
        userId,
        keywordId: keywordIds[i],
        chapterId,
        subjectId,
        bestFinalScore: scores[i],
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }
  if (withReflection) {
    await prisma.chapterReflection.create({
      data: { userId, chapterId, questions: json(["q"]), answers: json(["a"]), summary: "已完成本章反思" },
    });
  }
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { loginName: { startsWith: TAG } } });
  await prisma.subject.deleteMany({ where: { title: { startsWith: TAG } } });

  // startDate=今天 → 第 1 周周末在「本周末」，新建进度/反思的时间(now)都 <= 周末，满足结算时间窗。
  const subject = await prisma.subject.create({
    data: { title: `${TAG}-subject`, isActive: false, startDate: new Date() },
  });
  subjectId = subject.id;
  const chapter = await prisma.chapter.create({
    data: { subjectId, index: 1, title: "ch", theme: "t" },
  });
  chapterId = chapter.id;
  keywordIds = [];
  for (let i = 1; i <= 3; i += 1) {
    const kw = await prisma.keyword.create({
      data: { chapterId, term: `${TAG}-kw-${i}`, orderIndex: i },
    });
    keywordIds.push(kw.id);
  }

  await setup("A", [95, 95, 95], true); // 3/3 + 反思 → rank 1
  await setup("B", [88, 88, 88], true); // 3/3 + 反思 → rank 2
  await setup("C", [88, 88, 88], true); // 与 B 并列 rank 2
  await setup("F", [70, 70, 70], true); // rank 4（标准竞赛名次跳过 3），无奖
  await setup("D", [99, 99, 99], true, 2); // 仅 2/3 → 不入排名
  await setup("E", [99, 99, 99], false); // 3/3 但无反思 → 不入排名
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { loginName: { startsWith: TAG } } });
  await prisma.subject.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("周结算 settleChapterWeek（真 DB）", () => {
  it("仅全过 20 词且已反思者入排名；并列均给 +100；标准竞赛名次", async () => {
    const rows = await settleChapterWeek(subjectId, chapterId, 1);
    const byUser = new Map(rows.map((r) => [r.userId, r]));

    // 资格门槛：D（2/3 未全完）、E（无反思）不入排名
    expect(byUser.has(users.D)).toBe(false);
    expect(byUser.has(users.E)).toBe(false);
    expect(rows.length).toBe(4); // A,B,C,F

    expect(byUser.get(users.A)!.rank).toBe(1);
    expect(byUser.get(users.B)!.rank).toBe(2);
    expect(byUser.get(users.C)!.rank).toBe(2); // 并列同名次
    expect(byUser.get(users.F)!.rank).toBe(4); // 两人并列 rank2 → 下一名是 4，不是 3

    // top3 均 +100；并列不稀释；F（rank4）无奖
    for (const k of ["A", "B", "C"]) {
      expect(byUser.get(users[k])!.bonusAwarded).toBe(true);
      const sum = await prisma.pointsLedger.aggregate({
        where: { userId: users[k], type: "RANK_BONUS" },
        _sum: { amount: true },
      });
      expect(sum._sum.amount).toBe(100);
    }
    expect(byUser.get(users.F)!.bonusAwarded).toBe(false);
    expect(
      await prisma.pointsLedger.count({ where: { userId: users.F, type: "RANK_BONUS" } }),
    ).toBe(0);
  });

  it("一次性快照：重复结算返回相同结果、不重复发奖", async () => {
    const before = await prisma.pointsLedger.count({ where: { subjectId, type: "RANK_BONUS" } });
    const rows = await settleChapterWeek(subjectId, chapterId, 1);
    expect(rows.length).toBe(4);
    const after = await prisma.pointsLedger.count({ where: { subjectId, type: "RANK_BONUS" } });
    expect(after).toBe(before); // 无新增
    expect(after).toBe(3); // 恰好 A/B/C 三笔
  });
});
