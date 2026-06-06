// ===========================================================================
// src/lib/learn.ts —— 学习闭环编排（PRD §6）。
// 两段式：startAttempt(写笔记→初分+追问) → completeAttempt(答追问→终评)。
// 终评后：取最高分进度、达标记 1 积分（幂等）、更新画像与成长轨迹。
// 纯服务层，便于直接测试；server actions 只做鉴权/校验/重渲染。
// ===========================================================================

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { runWithAiTrace, type AiTrace } from "@/lib/ai-log";
import { getLearnerContext } from "@/lib/learner";
import { applyMemoryUpdate } from "@/lib/memory";
import {
  type AnswerChunk,
  type AnswerQuestionInput,
  getScoringProvider,
  getScoringService,
  type Keyword,
  PASS_THRESHOLD,
} from "@/lib/scoring";
import {
  streamAnswerDeepSeek,
  streamFinalizeDeepSeek,
  streamSubmitNoteDeepSeek,
} from "@/lib/scoring/deepseek";

export const NOTE_MIN = 100;
export const NOTE_MAX = 2000;
/** 每条追问回答的字数上限。 */
export const ANSWER_MAX = 1000;
/** 结果页追加提问的字数上限。 */
export const QUESTION_MAX = 1000;
/** 每天最多新完成多少个关键词（重刷已完成的词不计入）。 */
export const DAILY_COMPLETION_LIMIT = 10;

/** 当天（本地自然日）已首次通关的关键词数。 */
export async function countTodayCompletions(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.keywordProgress.count({
    where: { userId, isCompleted: true, completedAt: { gte: start } },
  });
}

/** 把 DB 关键词转成打分服务的 Keyword（referencePoints 字符串拆成数组，带上章节主题）。 */
function toScoringKeyword(kw: {
  term: string;
  description: string | null;
  referencePoints: string | null;
  chapter?: { theme: string };
}): Keyword {
  return {
    term: kw.term,
    description: kw.description ?? undefined,
    referencePoints: kw.referencePoints
      ? kw.referencePoints.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
      : undefined,
    chapterTheme: kw.chapter?.theme,
  };
}

export interface StartAttemptResult {
  submissionId: string;
  initialScore: number;
  followups: string[];
}

/** 第一段：提交笔记 → 初分 + 动态追问，落库为待答状态的一次提交。
 *  传入 onReasoning（且当前为 deepseek）时走流式，把思考过程逐段回调出去。 */
export async function startAttempt(
  userId: string,
  keywordId: string,
  rawNote: string,
  onReasoning?: (text: string) => void,
): Promise<StartAttemptResult> {
  const note = rawNote.trim();
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    throw new Error(`笔记需 ${NOTE_MIN}–${NOTE_MAX} 字（当前 ${note.length}）`);
  }
  const keyword = await prisma.keyword.findUnique({
    where: { id: keywordId },
    include: { chapter: { select: { theme: true } } },
  });
  if (!keyword) throw new Error("关键词不存在");

  // 每天最多新完成 N 个：未完成的新词在达上限后不能再开（重刷已完成的词不受限）
  const prog = await prisma.keywordProgress.findUnique({
    where: { userId_keywordId: { userId, keywordId } },
    select: { isCompleted: true },
  });
  if (!prog?.isCompleted && (await countTodayCompletions(userId)) >= DAILY_COMPLETION_LIMIT) {
    throw new Error(`每天最多完成 ${DAILY_COMPLETION_LIMIT} 个关键词，今天已达上限，明天再来。`);
  }

  const learner = await getLearnerContext(userId);
  const scInput = { note, keyword: toScoringKeyword(keyword), learner };
  const trace: AiTrace = { phase: "submitNote", userId, keywordId, keywordTerm: keyword.term };
  // 流式时顺手累计思考过程，落库供学习者端「查看 AI 思考」小弹窗回看。
  let reasoning = "";
  const sc =
    onReasoning && getScoringProvider() === "deepseek"
      ? await streamSubmitNoteDeepSeek(scInput, trace, (text) => {
          reasoning += text;
          onReasoning(text);
        })
      : await runWithAiTrace(trace, () => getScoringService().submitNote(scInput));

  const submission = await prisma.submission.create({
    data: { userId, keywordId, noteText: note, status: "AWAITING_ANSWERS" },
  });
  const scoring = await prisma.scoring.create({
    data: {
      submissionId: submission.id,
      initialScore: sc.initialScore,
      initialReasoning: reasoning.trim() || null,
    },
  });
  await prisma.followup.createMany({
    data: sc.followups.map((q, i) => ({
      scoringId: scoring.id,
      order: i + 1,
      question: q,
    })),
  });

  // 提交成功，清掉该词草稿（中途退出保留记录的草稿到此完成使命）
  await prisma.noteDraft.deleteMany({ where: { userId, keywordId } });

  return { submissionId: submission.id, initialScore: sc.initialScore, followups: sc.followups };
}

export interface CompleteAttemptResult {
  finalScore: number;
  passed: boolean;
  feedback: string;
  bestScore: number;
  newlyCompleted: boolean;
  awardedPoint: boolean;
}

/** 第二段：保存追问回答 → 终评 → 取最高分进度 / 达标记分 / 更新画像。
 *  传入 onReasoning（且当前为 deepseek）时，终评走流式并把思考过程回调出去。 */
export async function completeAttempt(
  userId: string,
  submissionId: string,
  answers: string[],
  onReasoning?: (text: string) => void,
): Promise<CompleteAttemptResult> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      scoring: { include: { followups: { orderBy: { order: "asc" } } } },
      keyword: { include: { chapter: { select: { subjectId: true, theme: true } } } },
    },
  });
  if (!submission || submission.userId !== userId) throw new Error("提交不存在");
  if (submission.status !== "AWAITING_ANSWERS" || !submission.scoring) {
    throw new Error("该提交不在待答状态");
  }

  const followups = submission.scoring.followups;
  const keyword = submission.keyword;
  const subjectId = keyword.chapter.subjectId;
  const scKeyword = toScoringKeyword(keyword);
  const answerList = followups.map((_, i) => (answers[i] ?? "").trim());
  if (answerList.some((a) => a.length > ANSWER_MAX)) {
    throw new Error(`每条回答不超过 ${ANSWER_MAX} 字`);
  }

  // 保存回答
  await Promise.all(
    followups.map((f, i) =>
      prisma.followup.update({ where: { id: f.id }, data: { answer: answerList[i] } }),
    ),
  );

  const learner = await getLearnerContext(userId);
  const finInput = {
    note: submission.noteText,
    keyword: scKeyword,
    followups: followups.map((f) => f.question),
    answers: answerList,
    learner,
  };
  const finTrace: AiTrace = {
    phase: "finalize",
    userId,
    keywordId: keyword.id,
    keywordTerm: keyword.term,
    submissionId,
  };
  // 流式时累计终评思考过程，落库供「查看 AI 思考」小弹窗回看。
  let reasoning = "";
  const fin =
    onReasoning && getScoringProvider() === "deepseek"
      ? await streamFinalizeDeepSeek(finInput, finTrace, (text) => {
          reasoning += text;
          onReasoning(text);
        })
      : await runWithAiTrace(finTrace, () => getScoringService().finalize(finInput));

  await prisma.scoring.update({
    where: { id: submission.scoring.id },
    data: {
      finalScore: fin.finalScore,
      feedback: fin.feedback,
      finalReasoning: reasoning.trim() || null,
    },
  });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "COMPLETED", finalScore: fin.finalScore, isPassed: fin.passed },
  });

  // 取最高分进度
  const prev = await prisma.keywordProgress.findUnique({
    where: { userId_keywordId: { userId, keywordId: keyword.id } },
  });
  const isImprovement = !prev || fin.finalScore > prev.bestFinalScore;
  const bestScore = Math.max(prev?.bestFinalScore ?? 0, fin.finalScore);
  const becomesCompleted = bestScore >= PASS_THRESHOLD;
  const newlyCompleted = becomesCompleted && !prev?.isCompleted;

  const progress = await prisma.keywordProgress.upsert({
    where: { userId_keywordId: { userId, keywordId: keyword.id } },
    create: {
      userId,
      keywordId: keyword.id,
      chapterId: keyword.chapterId,
      subjectId,
      bestFinalScore: fin.finalScore,
      bestSubmissionId: submissionId,
      isCompleted: becomesCompleted,
      completedAt: becomesCompleted ? new Date() : null,
    },
    update: {
      bestFinalScore: bestScore,
      ...(isImprovement ? { bestSubmissionId: submissionId } : {}),
      isCompleted: becomesCompleted,
      ...(newlyCompleted ? { completedAt: new Date() } : {}),
    },
  });

  // 达标记 1 积分。自愈式：只要进度已完成且尚无 BASE 流水就补发（不依赖一次性的
  // newlyCompleted，避免某次瞬时故障后因 isCompleted 已 true 而永久漏发）。
  // 幂等由 @@unique([type, keywordProgressId]) 保证：P2002 视为已发，其它错误抛出。
  let awardedPoint = false;
  if (progress.isCompleted) {
    try {
      await prisma.pointsLedger.create({
        data: {
          userId,
          subjectId,
          type: "BASE",
          amount: 1,
          keywordProgressId: progress.id,
          memo: `完成关键词「${keyword.term}」`,
        },
      });
      awardedPoint = true;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        throw e;
      }
    }
  }

  // 更新画像与成长轨迹（每次终评都更新）；失败不影响本次评分结果
  try {
    await applyMemoryUpdate(userId, {
      keyword: scKeyword,
      keywordId: keyword.id,
      note: submission.noteText,
      followups: followups.map((f) => f.question),
      answers: answerList,
      finalScore: fin.finalScore,
    });
  } catch (err) {
    console.error("画像更新失败（不影响本次评分）：", err);
  }

  return {
    finalScore: fin.finalScore,
    passed: fin.passed,
    feedback: fin.feedback,
    bestScore,
    newlyCompleted,
    awardedPoint,
  };
}

// ---- 结果页追加提问（流式） ----

export interface AskContext {
  input: AnswerQuestionInput;
  submissionId: string;
  order: number;
  trace: AiTrace;
}

/** 校验 + 装配上下文（在开始流式前做，便于把错误以 HTTP 状态返回）。 */
export async function prepareAsk(
  userId: string,
  submissionId: string,
  rawQuestion: string,
): Promise<AskContext> {
  const question = rawQuestion.trim();
  if (question.length < 2) throw new Error("问题太短了，写清楚一点");
  if (question.length > QUESTION_MAX) throw new Error(`问题不超过 ${QUESTION_MAX} 字`);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      scoring: { include: { followups: { orderBy: { order: "asc" } } } },
      keyword: { include: { chapter: { select: { theme: true } } } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!submission || submission.userId !== userId) throw new Error("提交不存在");
  if (submission.status !== "COMPLETED") throw new Error("这个词还没完成，先答完追问再提问");

  const learner = await getLearnerContext(userId);
  const followups = submission.scoring?.followups ?? [];
  return {
    input: {
      keyword: toScoringKeyword(submission.keyword),
      note: submission.noteText,
      followups: followups.map((f) => f.question),
      answers: followups.map((f) => f.answer ?? ""),
      question,
      priorQA: submission.questions.map((q) => ({ question: q.question, answer: q.answer })),
      learner,
    },
    submissionId,
    order: submission.questions.length + 1,
    trace: {
      phase: "answerQuestion",
      userId,
      keywordId: submission.keywordId,
      keywordTerm: submission.keyword.term,
      submissionId,
    },
  };
}

/** 逐段产出思考过程 / 正文；结束后整段落库为一条 LearnerQuestion。deepseek 走真流式，mock 切片模拟。 */
export async function* streamAnswer(ctx: AskContext): AsyncGenerator<AnswerChunk> {
  let answer = "";
  let reasoning = "";
  if (getScoringProvider() === "deepseek") {
    for await (const chunk of streamAnswerDeepSeek(ctx.input, ctx.trace)) {
      if (chunk.type === "reasoning") reasoning += chunk.text;
      else answer += chunk.text;
      yield chunk;
    }
  } else {
    const full = (await getScoringService().answerQuestion(ctx.input)).answer;
    for (let i = 0; i < full.length; i += 12) {
      const text = full.slice(i, i + 12);
      answer += text;
      yield { type: "answer", text };
    }
  }
  await prisma.learnerQuestion.create({
    data: {
      submissionId: ctx.submissionId,
      order: ctx.order,
      question: ctx.input.question,
      answer,
      reasoning: reasoning || null,
    },
  });
}
