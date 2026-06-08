// ===========================================================================
// src/lib/reflection.ts —— 章节反思编排（PRD §14.4）。
// 学完整章后：生成结合岗位的反思问题 → 作答 → AI 总结 + 画像演进（融入岗位结合）。
// ===========================================================================

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { runWithAiTrace, type AiTrace } from "@/lib/ai-log";
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
  /** 生成总结时的 DeepSeek 思考过程（供「AI 思考过程」小弹窗）。 */
  reasoning: string;
  done: boolean;
}

/** 取该用户该章反思；不存在则生成问题并落库（草稿）。 */
export async function getOrCreateReflection(
  userId: string,
  chapterId: string,
): Promise<ReflectionView> {
  const toView = (r: {
    id: string;
    questions: unknown;
    answers: unknown;
    summary: string;
    reasoning: string | null;
  }): ReflectionView => ({
    id: r.id,
    questions: asStrings(r.questions),
    answers: asStrings(r.answers),
    summary: r.summary,
    reasoning: r.reasoning ?? "",
    done: r.summary.trim().length > 0,
  });

  const existing = await prisma.chapterReflection.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (existing) return toView(existing);

  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    include: { keywords: { select: { term: true } } },
  });
  const learner = await getLearnerContext(userId);
  const questions = await runWithAiTrace(
    { phase: "reflectionQuestions", userId, chapterId },
    () =>
      getScoringService().reflectionQuestions({
        chapterTitle: chapter.title,
        chapterTheme: chapter.theme,
        terms: chapter.keywords.map((k) => k.term),
        learner,
      }),
  );
  // 出题耗时较长（DeepSeek），其间可能有并发请求先建好同一条（页面重复渲染 / 预取 / 双击）。
  // 命中唯一约束（P2002）时复用已存在的那条，丢弃本次刚生成的问题，保证幂等。
  try {
    const created = await prisma.chapterReflection.create({
      data: { userId, chapterId, questions: json(questions), answers: json([]), summary: "" },
    });
    return { id: created.id, questions, answers: [], summary: "", reasoning: "", done: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await prisma.chapterReflection.findUniqueOrThrow({
        where: { userId_chapterId: { userId, chapterId } },
      });
      return toView(winner);
    }
    throw e;
  }
}

/** 提交反思作答：AI 总结 + 画像演进（融入岗位结合）+ 成长快照。
 *  传入 onReasoning（且当前为 deepseek）时，总结走流式并把思考过程逐段回调出去并落库。 */
export async function submitReflection(
  userId: string,
  chapterId: string,
  answers: string[],
  onReasoning?: (text: string) => void,
): Promise<{ summary: string }> {
  const reflection = await prisma.chapterReflection.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  if (!reflection) throw new Error("请先打开本章反思以生成问题");
  const questions = asStrings(reflection.questions);
  const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
  const learner = await getLearnerContext(userId);

  const sumInput = {
    chapterTitle: chapter.title,
    chapterTheme: chapter.theme,
    questions,
    answers,
    learner,
  };
  const trace: AiTrace = { phase: "reflectionSummary", userId, chapterId };
  // 流式时累计思考过程，落库供「AI 思考过程」小弹窗回看。
  let reasoning = "";
  const { summary, portrait } = await runWithAiTrace(trace, () =>
    getScoringService().reflectionSummary(sumInput, {
      onReasoning: onReasoning
        ? (text) => {
            reasoning += text;
            onReasoning(text);
          }
        : undefined,
    }),
  );

  await prisma.chapterReflection.update({
    where: { id: reflection.id },
    data: { answers: json(answers), summary, reasoning: reasoning.trim() || null },
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
