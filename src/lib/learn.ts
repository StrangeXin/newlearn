// ===========================================================================
// src/lib/learn.ts —— 学习闭环编排（PRD §6）。
// 两段式：startAttempt(写笔记→初分+追问) → completeAttempt(答追问→终评)。
// 终评后：取最高分进度、达标记 1 积分（幂等）、更新画像与成长轨迹。
// 纯服务层，便于直接测试；server actions 只做鉴权/校验/重渲染。
// ===========================================================================

import { prisma } from "@/lib/db";
import { getLearnerContext } from "@/lib/learner";
import { applyMemoryUpdate } from "@/lib/memory";
import { getScoringService, PASS_THRESHOLD, type Keyword } from "@/lib/scoring";

export const NOTE_MIN = 100;
export const NOTE_MAX = 5000;

/** 把 DB 关键词转成打分服务的 Keyword（referencePoints 字符串拆成数组）。 */
function toScoringKeyword(kw: {
  term: string;
  description: string | null;
  referencePoints: string | null;
}): Keyword {
  return {
    term: kw.term,
    description: kw.description ?? undefined,
    referencePoints: kw.referencePoints
      ? kw.referencePoints.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
      : undefined,
  };
}

export interface StartAttemptResult {
  submissionId: string;
  initialScore: number;
  followups: string[];
}

/** 第一段：提交笔记 → 初分 + 动态追问，落库为待答状态的一次提交。 */
export async function startAttempt(
  userId: string,
  keywordId: string,
  rawNote: string,
): Promise<StartAttemptResult> {
  const note = rawNote.trim();
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) {
    throw new Error(`笔记需 ${NOTE_MIN}–${NOTE_MAX} 字（当前 ${note.length}）`);
  }
  const keyword = await prisma.keyword.findUnique({ where: { id: keywordId } });
  if (!keyword) throw new Error("关键词不存在");

  const learner = await getLearnerContext(userId);
  const sc = await getScoringService().submitNote({
    note,
    keyword: toScoringKeyword(keyword),
    learner,
  });

  const submission = await prisma.submission.create({
    data: { userId, keywordId, noteText: note, status: "AWAITING_ANSWERS" },
  });
  const scoring = await prisma.scoring.create({
    data: { submissionId: submission.id, initialScore: sc.initialScore },
  });
  await prisma.followup.createMany({
    data: sc.followups.map((q, i) => ({
      scoringId: scoring.id,
      order: i + 1,
      question: q,
    })),
  });

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

/** 第二段：保存追问回答 → 终评 → 取最高分进度 / 达标记分 / 更新画像。 */
export async function completeAttempt(
  userId: string,
  submissionId: string,
  answers: string[],
): Promise<CompleteAttemptResult> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      scoring: { include: { followups: { orderBy: { order: "asc" } } } },
      keyword: { include: { chapter: { select: { subjectId: true } } } },
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

  // 保存回答
  await Promise.all(
    followups.map((f, i) =>
      prisma.followup.update({ where: { id: f.id }, data: { answer: answerList[i] } }),
    ),
  );

  const learner = await getLearnerContext(userId);
  const fin = await getScoringService().finalize({
    note: submission.noteText,
    keyword: scKeyword,
    followups: followups.map((f) => f.question),
    answers: answerList,
    learner,
  });

  await prisma.scoring.update({
    where: { id: submission.scoring.id },
    data: { finalScore: fin.finalScore, feedback: fin.feedback },
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

  // 达标记 1 积分（幂等：每个进度至多一条 BASE 流水）
  let awardedPoint = false;
  if (newlyCompleted) {
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
    } catch {
      // 唯一约束兜底：已发过则忽略
      awardedPoint = false;
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
