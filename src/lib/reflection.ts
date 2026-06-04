// ===========================================================================
// src/lib/reflection.ts —— 章节反思编排（PRD §14.4）。
// 学完整章后：生成结合岗位的反思问题 → 作答 → AI 总结 + 画像演进（融入岗位结合）。
// ===========================================================================

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getLearnerContext } from "@/lib/learner";
import { EMPTY_TAGS, getScoringService } from "@/lib/scoring";
import { computeMemoryDiff } from "@/lib/memory-diff";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** 该用户是否已通关某章全部关键词。 */
export async function isChapterFullyCompleted(
  userId: string,
  chapterId: string,
): Promise<boolean> {
  const [total, done] = await Promise.all([
    prisma.keyword.count({ where: { chapterId } }),
    prisma.keywordProgress.count({ where: { userId, chapterId, isCompleted: true } }),
  ]);
  return total > 0 && done >= total;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

export interface ReflectionView {
  id: string;
  questions: string[];
  answers: string[];
  summary: string;
  done: boolean;
}

/** 取该用户该章反思；不存在则生成问题并落库（草稿）。 */
export async function getOrCreateReflection(
  userId: string,
  chapterId: string,
): Promise<ReflectionView> {
  const existing = await prisma.chapterReflection.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (existing) {
    return {
      id: existing.id,
      questions: asStrings(existing.questions),
      answers: asStrings(existing.answers),
      summary: existing.summary,
      done: existing.summary.trim().length > 0,
    };
  }
  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    include: { keywords: { select: { term: true } } },
  });
  const learner = await getLearnerContext(userId);
  const questions = await getScoringService().reflectionQuestions({
    chapterTitle: chapter.title,
    chapterTheme: chapter.theme,
    terms: chapter.keywords.map((k) => k.term),
    learner,
  });
  const created = await prisma.chapterReflection.create({
    data: { userId, chapterId, questions: json(questions), answers: json([]), summary: "" },
  });
  return { id: created.id, questions, answers: [], summary: "", done: false };
}

/** 提交反思作答：AI 总结 + 画像演进（融入岗位结合）+ 成长快照。 */
export async function submitReflection(
  userId: string,
  chapterId: string,
  answers: string[],
): Promise<{ summary: string }> {
  const reflection = await prisma.chapterReflection.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (!reflection) throw new Error("请先打开本章反思以生成问题");
  const questions = asStrings(reflection.questions);
  const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
  const learner = await getLearnerContext(userId);

  const { summary, portrait } = await getScoringService().reflectionSummary({
    chapterTitle: chapter.title,
    chapterTheme: chapter.theme,
    questions,
    answers,
    learner,
  });

  await prisma.chapterReflection.update({
    where: { id: reflection.id },
    data: { answers: json(answers), summary },
  });

  // 画像演进（标签不变，仅画像融入岗位结合）+ 成长快照
  const prevTags = learner.memory?.tags ?? EMPTY_TAGS;
  const prevPortrait = learner.memory?.portrait ?? "";
  const avgAgg = await prisma.keywordProgress.aggregate({
    where: { userId, chapterId, isCompleted: true },
    _avg: { bestFinalScore: true },
  });
  const chapterAvg = Math.round(avgAgg._avg.bestFinalScore ?? 0);

  const memory = await prisma.employeeMemory.upsert({
    where: { userId },
    create: { userId, tags: json(prevTags), portrait, updateCount: 1 },
    update: { portrait, updateCount: { increment: 1 } },
  });
  const diff = computeMemoryDiff(prevTags, prevTags, prevPortrait, portrait);
  await prisma.employeeMemorySnapshot.create({
    data: {
      userId,
      keywordTerm: `第${chapter.index}章·章节反思`,
      finalScore: chapterAvg,
      tags: json(prevTags),
      portrait,
      diff: json(diff),
      seq: memory.updateCount,
    },
  });

  return { summary };
}
