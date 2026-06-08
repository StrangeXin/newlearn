import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveRedemption, getSubjectBalance, requestRedemption } from "@/lib/redemption";

// 审批扣分 / 防双花 / 可用余额校验此前零测试。独立学科 + 真 DB。
const TAG = "__itest_redeem__";

let userId = "";
let adminId = "";
let subjectId = "";

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { loginName: { startsWith: TAG } } });
  await prisma.subject.deleteMany({ where: { title: { startsWith: TAG } } });

  const subject = await prisma.subject.create({ data: { title: `${TAG}-subject`, isActive: false } });
  subjectId = subject.id;
  const u = await prisma.user.create({
    data: { loginName: `${TAG}-u`, name: `${TAG}-u`, passwordHash: "x", role: "EMPLOYEE" },
  });
  userId = u.id;
  const admin = await prisma.user.create({
    data: { loginName: `${TAG}-admin`, name: `${TAG}-admin`, passwordHash: "x", role: "ADMIN" },
  });
  adminId = admin.id;

  // 给该用户 100 分初始余额（一条流水即可，amount 之和=余额）
  await prisma.pointsLedger.create({
    data: { userId, subjectId, type: "RANK_BONUS", amount: 100, memo: `${TAG} 初始余额` },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { loginName: { startsWith: TAG } } });
  await prisma.subject.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe("兑换审批 approve→扣分（真 DB）", () => {
  it("通过即扣分、余额正确，且同一申请不可重复审批（防双花）", async () => {
    await requestRedemption(userId, subjectId, "技术书", 80);
    const redemption = await prisma.redemption.findFirstOrThrow({
      where: { userId, subjectId, status: "PENDING" },
    });

    await approveRedemption(adminId, redemption.id);
    expect(await getSubjectBalance(userId, subjectId)).toBe(20); // 100 - 80

    // 二次审批同一申请被 CAS 拦截
    await expect(approveRedemption(adminId, redemption.id)).rejects.toThrow();

    // 只有一条 REDEEM 流水、余额仍为 20（未双扣）
    expect(
      await prisma.pointsLedger.count({ where: { userId, subjectId, type: "REDEEM" } }),
    ).toBe(1);
    expect(await getSubjectBalance(userId, subjectId)).toBe(20);
  });

  it("可用余额不足时拒绝申请", async () => {
    // 余额 20，再申请 50 → 超额
    await expect(requestRedemption(userId, subjectId, "超额申请", 50)).rejects.toThrow();
  });
});
