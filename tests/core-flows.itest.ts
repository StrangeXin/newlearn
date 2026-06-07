import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { completeAttempt, startAttempt } from "@/lib/learn";

const TEST_LOGIN = "__itest_user__";
let userId = "";
let keywordId = "";

const goodNote =
  "这是一段足够长且认真的学习笔记。它解释了该关键词的核心原理、机制、典型应用与局限。\n" +
  "我结合实际工作场景说明了它为什么重要，并举了一个具体例子来加深理解。".repeat(140);
const goodAnswer =
  "我结合原理与具体例子充分展开了回答，覆盖了机制、应用与边界条件，内容比较详实可靠，并说明了在实际工作中如何运用。".repeat(2);

beforeAll(async () => {
  // 干净的测试用户 + 资料
  await prisma.user.deleteMany({ where: { loginName: TEST_LOGIN } });
  const user = await prisma.user.create({
    data: {
      loginName: TEST_LOGIN,
      name: "集成测试员",
      passwordHash: "x",
      role: "EMPLOYEE",
      profile: {
        create: {
          position: "测试岗",
          department: "QA",
          level: "P5",
          background: "软件",
          aiFamiliarity: "了解",
          applicationAreas: "测试自动化",
        },
      },
    },
  });
  userId = user.id;

  const subject = await prisma.subject.findFirstOrThrow({
    where: { isActive: true, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const ch1 = await prisma.chapter.findFirstOrThrow({
    where: { subjectId: subject.id, index: 1 },
    include: { keywords: { orderBy: { orderIndex: "asc" }, take: 1 } },
  });
  keywordId = ch1.keywords[0].id;
});

afterAll(async () => {
  // 级联清理测试用户的所有数据
  await prisma.user.deleteMany({ where: { loginName: TEST_LOGIN } });
  await prisma.$disconnect();
});

describe("学习闭环（真 DB + Mock 评分器）", () => {
  it("提交→初分+追问→终评→达标记 1 积分", async () => {
    const s = await startAttempt(userId, keywordId, goodNote);
    expect(s.followups.length).toBeGreaterThanOrEqual(1);
    expect(s.followups.length).toBeLessThanOrEqual(3);

    const r = await completeAttempt(userId, s.submissionId, s.followups.map(() => goodAnswer));
    expect(r.passed).toBe(true);
    expect(r.awardedPoint).toBe(true);

    const progress = await prisma.keywordProgress.findUniqueOrThrow({
      where: { userId_keywordId: { userId, keywordId } },
    });
    expect(progress.isCompleted).toBe(true);
  });

  it("重提取最高分、不重复发积分", async () => {
    const before = await prisma.keywordProgress.findUniqueOrThrow({
      where: { userId_keywordId: { userId, keywordId } },
    });
    const s = await startAttempt(userId, keywordId, goodNote + "补充更多细节。".repeat(10));
    const r = await completeAttempt(userId, s.submissionId, s.followups.map(() => goodAnswer));
    expect(r.awardedPoint).toBe(false); // 已发过，不重复
    expect(r.bestScore).toBeGreaterThanOrEqual(before.bestFinalScore);

    const base = await prisma.pointsLedger.count({ where: { userId, type: "BASE" } });
    expect(base).toBe(1);
  });

  it("终评后生成画像快照", async () => {
    const snaps = await prisma.employeeMemorySnapshot.count({ where: { userId } });
    expect(snaps).toBeGreaterThanOrEqual(2); // 两次终评各一张
  });
});
