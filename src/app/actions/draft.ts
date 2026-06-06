"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";

// 草稿允许任意长度，但设个上限防滥用（远大于 2000 字正文上限）
const DRAFT_MAX = 12000;

/** 自动保存笔记草稿（中途退出保留记录）。空内容则删除草稿。 */
export async function saveNoteDraftAction(keywordId: string, text: string): Promise<void> {
  const user = await requireUser();
  if (!keywordId) return;
  const value = text.slice(0, DRAFT_MAX);
  if (value.trim().length === 0) {
    await prisma.noteDraft.deleteMany({ where: { userId: user.id, keywordId } });
    return;
  }
  await prisma.noteDraft.upsert({
    where: { userId_keywordId: { userId: user.id, keywordId } },
    create: { userId: user.id, keywordId, text: value },
    update: { text: value },
  });
}

/** 自动保存追问回答（落到既有 Followup.answer，终评时再覆盖为最终回答）。 */
export async function saveAnswersDraftAction(
  submissionId: string,
  answers: string[],
): Promise<void> {
  const user = await requireUser();
  if (!submissionId) return;
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { scoring: { include: { followups: { orderBy: { order: "asc" } } } } },
  });
  if (
    !submission ||
    submission.userId !== user.id ||
    submission.status !== "AWAITING_ANSWERS" ||
    !submission.scoring
  ) {
    return;
  }
  const followups = submission.scoring.followups;
  await Promise.all(
    followups.map((f, i) =>
      prisma.followup.update({
        where: { id: f.id },
        data: { answer: (answers[i] ?? "").slice(0, DRAFT_MAX) },
      }),
    ),
  );
}
