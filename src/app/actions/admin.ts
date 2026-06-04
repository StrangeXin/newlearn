"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdminState {
  error?: string;
  ok?: boolean;
}

/**
 * 演示用：把当前活跃学科的开始日前移/后移若干周，从而改变「当前周」。
 * deltaWeeks=+1 表示「快进一周」（开始日提前 7 天）。
 */
export async function shiftWeeksAction(deltaWeeks: number): Promise<AdminState> {
  await requireAdmin();
  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  if (!cfg?.activeSubjectId) return { error: "当前没有活跃学科" };
  const subject = await prisma.subject.findUnique({ where: { id: cfg.activeSubjectId } });
  if (!subject?.startDate) return { error: "学科未设开始日" };

  const next = new Date(subject.startDate.getTime() - deltaWeeks * 7 * DAY_MS);
  await prisma.subject.update({ where: { id: subject.id }, data: { startDate: next } });
  revalidatePath("/admin");
  revalidatePath("/learn");
  return { ok: true };
}
