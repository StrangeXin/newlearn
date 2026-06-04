"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/user";
import {
  approveRedemption,
  rejectRedemption,
  requestRedemption,
} from "@/lib/redemption";

export interface RedeemState {
  error?: string;
  ok?: boolean;
}

async function activeSubjectId(): Promise<string | null> {
  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  return cfg?.activeSubjectId ?? null;
}

/** 员工发起兑换申请（针对当前活跃学科）。 */
export async function requestRedemptionAction(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const user = await requireUser();
  const subjectId = await activeSubjectId();
  if (!subjectId) return { error: "当前没有活跃学科" };

  const item = String(formData.get("item") ?? "");
  const amount = Number(formData.get("amount") ?? "0");
  const attachment = String(formData.get("attachment") ?? "");
  try {
    await requestRedemption(user.id, subjectId, item, amount, attachment);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "提交失败，请重试" };
  }
  revalidatePath("/redeem");
  return { ok: true };
}

/** 管理员审批通过。 */
export async function approveRedemptionAction(
  redemptionId: string,
): Promise<RedeemState> {
  const admin = await requireAdmin();
  try {
    await approveRedemption(admin.id, redemptionId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  revalidatePath("/admin/redemptions");
  return { ok: true };
}

/** 管理员驳回。 */
export async function rejectRedemptionAction(
  redemptionId: string,
): Promise<RedeemState> {
  const admin = await requireAdmin();
  try {
    await rejectRedemption(admin.id, redemptionId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  revalidatePath("/admin/redemptions");
  return { ok: true };
}
