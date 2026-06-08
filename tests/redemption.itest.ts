import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addRedemptionFeedback,
  approveRedemption,
  getAccountBalance,
  getSharedRedemptions,
  requestRedemption,
} from "@/lib/redemption";

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
    await requestRedemption(userId, "技术书", 80, "BOOK");
    const redemption = await prisma.redemption.findFirstOrThrow({
      where: { userId, status: "PENDING" },
    });

    await approveRedemption(adminId, redemption.id);
    expect(await getAccountBalance(userId)).toBe(20); // 100 - 80

    // 二次审批同一申请被 CAS 拦截
    await expect(approveRedemption(adminId, redemption.id)).rejects.toThrow();

    // 只有一条 REDEEM 流水、余额仍为 20（未双扣）
    expect(
      await prisma.pointsLedger.count({ where: { userId, type: "REDEEM" } }),
    ).toBe(1);
    expect(await getAccountBalance(userId)).toBe(20);
  });

  it("可用余额不足时拒绝申请", async () => {
    // 余额 20，再申请 50 → 超额
    await expect(requestRedemption(userId, "超额申请", 50, "OTHER")).rejects.toThrow();
  });

  it("已通过兑换进共享目录，任何人可反馈", async () => {
    // 上面的「技术书」已审批通过 → 出现在全局共享目录，类别为 BOOK
    const mine = (await getSharedRedemptions()).find(
      (s) => s.ownerName === `${TAG}-u` && s.item === "技术书",
    );
    expect(mine).toBeTruthy();
    expect(mine!.category).toBe("BOOK");
    expect(mine!.feedback.length).toBe(0);

    // 管理员（任何人）留一条反馈
    await addRedemptionFeedback(adminId, mine!.id, "UP", "很实用，推荐借阅");
    const after = (await getSharedRedemptions()).find((s) => s.id === mine!.id);
    expect(after!.feedback.length).toBe(1);
    expect(after!.feedback[0].sentiment).toBe("UP");
    expect(after!.feedback[0].content).toBe("很实用，推荐借阅");
  });
});
