// ===========================================================================
// src/lib/ledger.ts —— 积分流水的唯一写入口（PRD §8.1）。
// 调用方只表达「意图」（完成某词 / 某周排名 / 某笔兑换），由本模块决定：
//   - amount 正负号（BASE +1 / RANK_BONUS +100 / REDEEM 取负）
//   - 幂等键字段（keywordProgressId / rankingResultId / redemptionId）
//   - 备注文案
// 三处写入（learn / ranking / redemption）从此收口到一处；stats 读取信任统一形状与符号。
// ===========================================================================

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

/** 每章前三名排名奖励分（PRD §7.2 / §8.1）。 */
export const RANK_BONUS_POINTS = 100;

type Tx = Prisma.TransactionClient;

/** 一笔流水的意图（与三种 LedgerType 一一对应；金额一律给正数，符号由本模块定）。 */
export type LedgerEntry =
  | {
      type: "BASE";
      userId: string;
      subjectId: string;
      keywordProgressId: string;
      keywordTerm: string;
    }
  | {
      type: "RANK_BONUS";
      userId: string;
      subjectId: string;
      rankingResultId: string;
      weekIndex: number;
      rank: number;
    }
  | {
      type: "REDEEM";
      userId: string;
      redemptionId: string;
      amount: number; // 正数金额，落库取负
      item: string;
    };

/** 把意图翻成落库数据：正负号、幂等键、备注都在此固化。 */
function toCreateData(entry: LedgerEntry): Prisma.PointsLedgerUncheckedCreateInput {
  switch (entry.type) {
    case "BASE":
      return {
        userId: entry.userId,
        subjectId: entry.subjectId,
        type: "BASE",
        amount: 1,
        keywordProgressId: entry.keywordProgressId,
        memo: `完成关键词「${entry.keywordTerm}」`,
      };
    case "RANK_BONUS":
      return {
        userId: entry.userId,
        subjectId: entry.subjectId,
        type: "RANK_BONUS",
        amount: RANK_BONUS_POINTS,
        rankingResultId: entry.rankingResultId,
        memo: `第${entry.weekIndex}周排名奖励（第${entry.rank}名）`,
      };
    case "REDEEM":
      // 统一钱包：REDEEM 为账号级扣减，不挂学科（subjectId 留空）。
      return {
        userId: entry.userId,
        type: "REDEEM",
        amount: -Math.abs(entry.amount),
        redemptionId: entry.redemptionId,
        memo: `兑换「${entry.item}」`,
      };
  }
}

/** 在给定事务里写一笔流水（结算 / 兑换用）。幂等由唯一约束保证，调用方已确保不重复。 */
export function writeLedgerTx(tx: Tx, entry: LedgerEntry): Promise<unknown> {
  return tx.pointsLedger.create({ data: toCreateData(entry) });
}

/**
 * 幂等发放一笔流水（自愈式）：命中唯一约束（已发过）视为成功返回 false，新发返回 true。
 * 供基础积分「完成即补发、重复调用安全」用（PRD §6 取最高分 / §8.1）。
 */
export async function awardLedgerOnce(entry: LedgerEntry): Promise<boolean> {
  try {
    await prisma.pointsLedger.create({ data: toCreateData(entry) });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return false; // 已发过，幂等
    }
    throw e;
  }
}
