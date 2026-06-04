"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { submitReflection } from "@/lib/reflection";

export interface ReflectState {
  error?: string;
}

export async function submitReflectionAction(
  _prev: ReflectState,
  formData: FormData,
): Promise<ReflectState> {
  const user = await requireUser();
  const chapterId = String(formData.get("chapterId") ?? "");
  const chapterIndex = String(formData.get("chapterIndex") ?? "");
  const answers = formData.getAll("answer").map((a) => String(a));
  if (!chapterId) return { error: "缺少章节" };
  try {
    await submitReflection(user.id, chapterId, answers);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "提交失败，请重试" };
  }
  if (chapterIndex) revalidatePath(`/learn/chapter/${chapterIndex}/reflect`);
  revalidatePath("/growth");
  return {};
}
