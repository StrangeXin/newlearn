"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/user";
import { getActiveSubjectById } from "@/lib/subject";
import {
  approveRedemption,
  rejectRedemption,
  requestRedemption,
  type RedemptionAttachmentInput,
} from "@/lib/redemption";
import {
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENT_SIZE,
  isAllowedAttachmentType,
} from "@/lib/upload";

export interface RedeemState {
  error?: string;
  ok?: boolean;
}

/** 员工发起兑换申请（积分按学科隔离，subjectId 随表单提交；凭证为上传的截图/PDF）。 */
export async function requestRedemptionAction(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  const user = await requireUser();
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return { error: "缺少学科" };
  const subject = await getActiveSubjectById(subjectId);
  if (!subject) return { error: "该学科不可用" };

  const item = String(formData.get("item") ?? "");
  const amount = Number(formData.get("amount") ?? "0");

  // 凭证文件可选；上传则校验类型与大小，读成字节交给 lib 落库
  let attachment: RedemptionAttachmentInput | undefined;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (!isAllowedAttachmentType(file.type)) {
      return { error: "凭证仅支持图片（PNG/JPG/WebP）或 PDF" };
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return { error: `凭证不能超过 ${MAX_ATTACHMENT_MB}MB` };
    }
    attachment = {
      fileName: file.name || "凭证",
      mimeType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    };
  }

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
