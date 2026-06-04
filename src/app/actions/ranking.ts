"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { settleChapterWeek } from "@/lib/ranking";

export interface RankingState {
  error?: string;
  ok?: boolean;
  count?: number;
}

/** 管理员结算某章排名（第 N 章对应第 N 周）。 */
export async function settleChapterAction(chapterId: string): Promise<RankingState> {
  await requireAdmin();
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) return { error: "章节不存在" };
  try {
    const rows = await settleChapterWeek(chapter.subjectId, chapter.id, chapter.index);
    revalidatePath("/admin/rankings");
    revalidatePath("/learn");
    return { ok: true, count: rows.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "结算失败" };
  }
}
