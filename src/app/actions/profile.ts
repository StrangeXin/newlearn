"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";

const schema = z.object({
  position: z.string().min(1, "请填写岗位").max(50),
  department: z.string().min(1, "请填写部门").max(50),
  level: z.string().min(1, "请填写职级 / 工作年限").max(50),
  background: z.string().min(1, "请填写专业背景").max(500),
  aiFamiliarity: z.string().min(1, "请选择对 AI 的熟悉度"),
  applicationAreas: z.string().min(1, "请填写最想把 AI 用在哪些工作").max(500),
});

export interface ProfileState {
  error?: string;
}

export async function saveProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const data = {
    position: String(formData.get("position") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    level: String(formData.get("level") ?? "").trim(),
    background: String(formData.get("background") ?? "").trim(),
    aiFamiliarity: String(formData.get("aiFamiliarity") ?? "").trim(),
    applicationAreas: String(formData.get("applicationAreas") ?? "").trim(),
  };
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  // 初始化空记忆（若已存在则保留）
  await prisma.employeeMemory.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tags: { strengths: [], weaknesses: [], interests: [], blindSpots: [] },
      portrait: "",
    },
    update: {},
  });

  redirect("/learn");
}

export interface EditProfileState {
  error?: string;
  ok?: boolean;
}

/** 员工在「我的资料」页编辑基本资料（资料可改，画像只读）。 */
export async function editProfileAction(
  _prev: EditProfileState,
  formData: FormData,
): Promise<EditProfileState> {
  const user = await requireUser();
  const data = {
    position: String(formData.get("position") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    level: String(formData.get("level") ?? "").trim(),
    background: String(formData.get("background") ?? "").trim(),
    aiFamiliarity: String(formData.get("aiFamiliarity") ?? "").trim(),
    applicationAreas: String(formData.get("applicationAreas") ?? "").trim(),
  };
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/profile");
  return { ok: true };
}
