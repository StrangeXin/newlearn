// ===========================================================================
// src/lib/memory.ts —— 画像更新服务（生产）。
// 每个关键词终评后调用：跑打分服务的 updateMemory，写当前记忆 + 追加历史快照。
// （S3 学习闭环的 finalize 流程会调用本函数。）
// ===========================================================================

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getLearnerContext } from "@/lib/learner";
import { EMPTY_TAGS, getScoringService, type Keyword } from "@/lib/scoring";
import { computeMemoryDiff } from "@/lib/memory-diff";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export interface MemoryUpdateParams {
  keyword: Keyword;
  keywordId?: string;
  note: string;
  followups: string[];
  answers: string[];
  finalScore: number;
}

/** 应用一次画像更新，并落一条历史快照。返回新快照的 seq。 */
export async function applyMemoryUpdate(
  userId: string,
  params: MemoryUpdateParams,
): Promise<{ seq: number }> {
  const ctx = await getLearnerContext(userId);
  const prevTags = ctx.memory?.tags ?? EMPTY_TAGS;
  const prevPortrait = ctx.memory?.portrait ?? "";

  const result = await getScoringService().updateMemory({
    keyword: params.keyword,
    note: params.note,
    followups: params.followups,
    answers: params.answers,
    finalScore: params.finalScore,
    learner: ctx,
  });

  const diff = computeMemoryDiff(prevTags, result.tags, prevPortrait, result.portrait);

  const memory = await prisma.employeeMemory.upsert({
    where: { userId },
    create: {
      userId,
      tags: json(result.tags),
      portrait: result.portrait,
      updateCount: 1,
    },
    update: {
      tags: json(result.tags),
      portrait: result.portrait,
      updateCount: { increment: 1 },
    },
  });

  await prisma.employeeMemorySnapshot.create({
    data: {
      userId,
      keywordId: params.keywordId ?? null,
      keywordTerm: params.keyword.term,
      finalScore: params.finalScore,
      tags: json(result.tags),
      portrait: result.portrait,
      diff: json(diff),
      seq: memory.updateCount,
    },
  });

  return { seq: memory.updateCount };
}
