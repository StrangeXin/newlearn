"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { completeAttempt, startAttempt } from "@/lib/learn";

export interface LearnState {
  error?: string;
}

/** 提交笔记 → 初分 + 追问（落库待答），随后页面重渲染进入答追问步骤。 */
export async function submitNoteAction(
  _prev: LearnState,
  formData: FormData,
): Promise<LearnState> {
  const user = await requireUser();
  const keywordId = String(formData.get("keywordId") ?? "");
  const note = String(formData.get("note") ?? "");
  if (!keywordId) return { error: "缺少关键词" };
  try {
    await startAttempt(user.id, keywordId, note);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "提交失败，请重试" };
  }
  revalidatePath(`/learn/keyword/${keywordId}`);
  return {};
}

/** 提交追问回答 → 终评，随后页面重渲染展示结果。 */
export async function submitAnswersAction(
  _prev: LearnState,
  formData: FormData,
): Promise<LearnState> {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const keywordId = String(formData.get("keywordId") ?? "");
  const answers = formData.getAll("answer").map((a) => String(a));
  if (!submissionId) return { error: "缺少提交标识" };
  try {
    await completeAttempt(user.id, submissionId, answers);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "评分失败，请重试" };
  }
  if (keywordId) revalidatePath(`/learn/keyword/${keywordId}`);
  return {};
}
