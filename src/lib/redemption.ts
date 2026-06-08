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
import type { FeedbackSentiment, Prisma, RedemptionCategory } from "@/generated/prisma/client";
import { writeLedgerTx } from "@/lib/ledger";

/** 共享反馈正文上限。 */
export const MAX_FEEDBACK_LEN = 500;

/** 单笔兑换金额上限（兼顾 Int32 与业务合理性）。 */
export const MAX_REDEEM_AMOUNT = 100_000;

/** 报销凭证文件（截图/PDF）；由 action 校验类型与大小后传入。 */
export interface RedemptionAttachmentInput {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}

type Tx = Prisma.TransactionClient;

/** 对 userId 账户加事务级 advisory 锁，串行化同一账号的申请/审批（统一钱包，不分学科）。 */
async function lockAccount(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`redeem:${userId}`}))`;
}

/** 账号积分余额（统一钱包：全部流水求和，跨学科）。 */
async function balanceIn(tx: Tx, userId: string): Promise<number> {
  const agg = await tx.pointsLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

async function pendingIn(tx: Tx, userId: string): Promise<number> {
  const agg = await tx.redemption.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** 账号积分余额（统一钱包，跨学科流水求和）。 */
export async function getAccountBalance(userId: string): Promise<number> {
  return balanceIn(prisma, userId);
}

/** 待审批申请占用的额度（账号级）。 */
export async function getPendingRedeemTotal(userId: string): Promise<number> {
  return pendingIn(prisma, userId);
}

/** 可用余额 = 账号余额 − 待审批占用。 */
export async function getAvailableBalance(userId: string): Promise<number> {
  const [balance, pending] = await Promise.all([
    getAccountBalance(userId),
    getPendingRedeemTotal(userId),
  ]);
  return balance - pending;
}

export interface LedgerEntryView {
  id: string;
  type: "BASE" | "RANK_BONUS" | "REDEEM";
  amount: number;
  memo: string;
  /** 来源学科标题（赚分侧 BASE/RANK_BONUS）；兑换扣减为 null。 */
  source: string | null;
  createdAt: Date;
}

/** 账号积分流水（统一钱包，全部来源，倒序）：每笔的类型/金额/来源/备注/时间。 */
export async function getPointsLedger(userId: string): Promise<LedgerEntryView[]> {
  const rows = await prisma.pointsLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { title: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    memo: r.memo ?? "",
    source: r.subject?.title ?? null,
    createdAt: r.createdAt,
  }));
}

/** 员工发起兑换申请（统一钱包：账户锁内重算 available 再创建，防并发超额）。 */
export async function requestRedemption(
  userId: string,
  item: string,
  amount: number,
  category: RedemptionCategory,
  attachment?: RedemptionAttachmentInput,
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
    await lockAccount(tx, userId);
    const available = (await balanceIn(tx, userId)) - (await pendingIn(tx, userId));
    if (amount > available) {
      throw new Error(`可用积分不足（当前可用 ${available}，含已占用的待审批申请）`);
    }
    const redemption = await tx.redemption.create({
      data: { userId, item: trimmedItem, amount, category },
    });
    if (attachment) {
      await tx.redemptionAttachment.create({
        data: {
          redemptionId: redemption.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.data.byteLength,
          data: Buffer.from(attachment.data),
        },
      });
    }
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
    await lockAccount(tx, r.userId);

    // CAS：只有仍为 PENDING 才能翻成 APPROVED（防并发双重处理 / 覆盖审批人）
    const cas = await tx.redemption.updateMany({
      where: { id: redemptionId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() },
    });
    if (cas.count === 0) throw new Error("该申请已处理过");

    const balance = await balanceIn(tx, r.userId);
    if (r.amount > balance) throw new Error("该员工积分余额不足，无法通过");

    await writeLedgerTx(tx, {
      type: "REDEEM",
      userId: r.userId,
      redemptionId: r.id,
      amount: r.amount,
      item: r.item,
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

// ===========================================================================
// 共享兑换目录（PRD §8.4）：全员已通过兑换跨学科公开，供互相借阅/共用 + 反馈。
// ===========================================================================

export interface SharedFeedback {
  id: string;
  authorName: string;
  sentiment: FeedbackSentiment | null;
  content: string;
  createdAt: Date;
}

export interface SharedRedemption {
  id: string;
  item: string;
  category: RedemptionCategory;
  ownerName: string;
  amount: number;
  createdAt: Date;
  feedback: SharedFeedback[];
}

/** 全员已通过(APPROVED)兑换，跨学科、按通过时间倒序，带持有人与反馈（「大家兑换了什么」）。 */
export async function getSharedRedemptions(): Promise<SharedRedemption[]> {
  const rows = await prisma.redemption.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    include: {
      user: { select: { name: true } },
      feedback: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    item: r.item,
    category: r.category,
    ownerName: r.user.name,
    amount: r.amount,
    createdAt: r.reviewedAt ?? r.createdAt,
    feedback: r.feedback.map((f) => ({
      id: f.id,
      authorName: f.user.name,
      sentiment: f.sentiment,
      content: f.content,
      createdAt: f.createdAt,
    })),
  }));
}

/** 任何员工对某条已通过兑换留一条反馈（短文本 + 可选倾向）。 */
export async function addRedemptionFeedback(
  userId: string,
  redemptionId: string,
  sentiment: FeedbackSentiment | null,
  content: string,
): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error("请填写反馈内容");
  if (text.length > MAX_FEEDBACK_LEN) throw new Error(`反馈不超过 ${MAX_FEEDBACK_LEN} 字`);
  const redemption = await prisma.redemption.findUnique({
    where: { id: redemptionId },
    select: { status: true },
  });
  if (!redemption || redemption.status !== "APPROVED") throw new Error("该兑换不可反馈");
  await prisma.redemptionFeedback.create({
    data: { redemptionId, userId, sentiment, content: text },
  });
}
