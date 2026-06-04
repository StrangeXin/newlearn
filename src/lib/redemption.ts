// ===========================================================================
// src/lib/redemption.ts —— 积分兑换（PRD §8）。
// 1 积分 = 1 元；可多次部分兑换。员工申请 → 管理员审批通过才扣分。
// 扣分走 REDEEM 流水（amount 为负，按 redemptionId 幂等：每笔兑换至多一条）。
//
// 并发安全：申请/审批均在交互式事务内对「该用户该学科账户」加 advisory 锁，
// 锁内重算余额再写入，杜绝 TOCTOU 超额；状态翻转用条件更新(CAS)做乐观锁，
// 杜绝并发 approve/reject 交叉导致的脏数据。
// ===========================================================================

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** 单笔兑换金额上限（兼顾 Int32 与业务合理性）。 */
export const MAX_REDEEM_AMOUNT = 100_000;

type Tx = Prisma.TransactionClient;

/** 对 (userId, subjectId) 账户加事务级 advisory 锁，串行化同账户的申请/审批。 */
async function lockAccount(tx: Tx, userId: string, subjectId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${subjectId}`}))`;
}

async function balanceIn(tx: Tx, userId: string, subjectId: string): Promise<number> {
  const agg = await tx.pointsLedger.aggregate({
    where: { userId, subjectId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

async function pendingIn(tx: Tx, userId: string, subjectId: string): Promise<number> {
  const agg = await tx.redemption.aggregate({
    where: { userId, subjectId, status: "PENDING" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** 某学科的积分余额（流水求和）。 */
export async function getSubjectBalance(
  userId: string,
  subjectId: string,
): Promise<number> {
  return balanceIn(prisma, userId, subjectId);
}

/** 待审批申请占用的额度。 */
export async function getPendingRedeemTotal(
  userId: string,
  subjectId: string,
): Promise<number> {
  return pendingIn(prisma, userId, subjectId);
}

/** 可用余额 = 已结算余额 − 待审批占用。 */
export async function getAvailableBalance(
  userId: string,
  subjectId: string,
): Promise<number> {
  const [balance, pending] = await Promise.all([
    getSubjectBalance(userId, subjectId),
    getPendingRedeemTotal(userId, subjectId),
  ]);
  return balance - pending;
}

/** 员工发起兑换申请（账户锁内重算 available 再创建，防并发超额）。 */
export async function requestRedemption(
  userId: string,
  subjectId: string,
  item: string,
  amount: number,
  attachment?: string,
): Promise<void> {
  const trimmedItem = item.trim();
  if (!trimmedItem) throw new Error("请填写兑换的物品 / 工具");
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("兑换金额需为正整数");
  }
  if (amount > MAX_REDEEM_AMOUNT) {
    throw new Error(`单笔兑换金额不能超过 ${MAX_REDEEM_AMOUNT}`);
  }

  await prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId, subjectId);
    const available =
      (await balanceIn(tx, userId, subjectId)) - (await pendingIn(tx, userId, subjectId));
    if (amount > available) {
      throw new Error(`可用积分不足（当前可用 ${available}，含已占用的待审批申请）`);
    }
    await tx.redemption.create({
      data: {
        userId,
        subjectId,
        item: trimmedItem,
        amount,
        attachment: attachment?.trim() || null,
      },
    });
  });
}

/** 管理员审批通过：账户锁内 CAS 翻转状态 + 重算余额 + 落 REDEEM 扣分（全原子）。 */
export async function approveRedemption(
  adminId: string,
  redemptionId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const r = await tx.redemption.findUnique({ where: { id: redemptionId } });
    if (!r) throw new Error("兑换申请不存在");
    await lockAccount(tx, r.userId, r.subjectId);

    // CAS：只有仍为 PENDING 才能翻成 APPROVED（防并发双重处理 / 覆盖审批人）
    const cas = await tx.redemption.updateMany({
      where: { id: redemptionId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() },
    });
    if (cas.count === 0) throw new Error("该申请已处理过");

    const balance = await balanceIn(tx, r.userId, r.subjectId);
    if (r.amount > balance) throw new Error("该员工积分余额不足，无法通过");

    await tx.pointsLedger.create({
      data: {
        userId: r.userId,
        subjectId: r.subjectId,
        type: "REDEEM",
        amount: -r.amount,
        redemptionId: r.id,
        memo: `兑换「${r.item}」`,
      },
    });
  });
}

/** 管理员驳回：CAS 翻转状态，不扣分。 */
export async function rejectRedemption(
  adminId: string,
  redemptionId: string,
): Promise<void> {
  const cas = await prisma.redemption.updateMany({
    where: { id: redemptionId, status: "PENDING" },
    data: { status: "REJECTED", reviewedById: adminId, reviewedAt: new Date() },
  });
  if (cas.count === 0) throw new Error("兑换申请不存在或已处理过");
}
