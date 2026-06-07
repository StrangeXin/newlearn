"use server";

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperadmin } from "@/lib/auth/user";
import { hashPassword } from "@/lib/auth/password";
import { keywordIllustrationFilePath } from "@/lib/keyword-illustration-assets";
import { buildKeywordIllustrationPrompt } from "@/lib/keyword-illustration-prompt";

const DAY_MS = 24 * 60 * 60 * 1000;
const execFileAsync = promisify(execFile);

function defaultPassword(): string {
  return process.env.DEFAULT_PASSWORD ?? "Aa123456!";
}

export interface AdminState {
  error?: string;
  ok?: boolean;
  path?: string;
}

/**
 * 演示用：把指定学科的开始日前移/后移若干周，从而改变其「当前周」。
 * deltaWeeks=+1 表示「快进一周」（开始日提前 7 天）。
 */
export async function shiftWeeksAction(
  subjectId: string,
  deltaWeeks: number,
): Promise<AdminState> {
  await requireAdmin();
  if (!subjectId) return { error: "缺少学科" };
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject?.startDate) return { error: "学科未设开始日" };

  const next = new Date(subject.startDate.getTime() - deltaWeeks * 7 * DAY_MS);
  await prisma.subject.update({ where: { id: subject.id }, data: { startDate: next } });
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/learn");
  return { ok: true };
}

// ----------------------------- 名单 / 角色 -----------------------------

/** 添加单个员工（姓名+角色）。 */
export async function addUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "EMPLOYEE");
  if (!name) return { error: "请填写姓名" };
  const loginName = name.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { loginName } });
  if (exists) return { error: "该姓名已存在" };
  await prisma.user.create({
    data: {
      loginName,
      name,
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
      passwordHash: await hashPassword(defaultPassword()),
      mustChangePassword: true,
      isActivated: false,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** 批量导入员工（每行一个姓名，已存在的跳过）。 */
export async function importUsersAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const text = String(formData.get("names") ?? "");
  const names = [...new Set(text.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean))];
  if (names.length === 0) return { error: "请粘贴姓名（每行一个）" };
  const hash = await hashPassword(defaultPassword());
  let added = 0;
  for (const name of names) {
    const loginName = name.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { loginName } });
    if (exists) continue;
    await prisma.user.create({
      data: { loginName, name, role: "EMPLOYEE", passwordHash: hash, mustChangePassword: true, isActivated: false },
    });
    added += 1;
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/** 重置某员工密码为默认密码并要求改密。 */
export async function resetPasswordAction(userId: string): Promise<AdminState> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(defaultPassword()), mustChangePassword: true },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** 超管设置某用户角色（提升/降为管理员/员工）。 */
export async function setRoleAction(userId: string, role: string): Promise<AdminState> {
  const me = await requireSuperadmin();
  if (userId === me.id) return { error: "不能修改自己的角色" };
  const target = role === "ADMIN" ? "ADMIN" : role === "SUPERADMIN" ? "SUPERADMIN" : "EMPLOYEE";
  await prisma.user.update({
    where: { id: userId },
    data: { role: target, roleChangedById: me.id, roleChangedAt: new Date() },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ----------------------------- 学科 / 内容 -----------------------------

/**
 * 上线 / 下线某学科（isActive）。可同时上线多个学科，员工自由选择学习哪个。
 * 上线时若尚未设开始日，则学员侧显示「未开课」直到管理员设开始日。
 */
export async function toggleSubjectActiveAction(
  subjectId: string,
  active: boolean,
): Promise<AdminState> {
  await requireAdmin();
  if (!subjectId) return { error: "缺少学科" };
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { _count: { select: { chapters: true } } },
  });
  if (!subject) return { error: "学科不存在" };
  if (active && subject._count.chapters === 0) {
    return { error: "该学科还没有内容，先导入章节再上线" };
  }
  await prisma.subject.update({ where: { id: subjectId }, data: { isActive: active } });
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/learn");
  return { ok: true };
}

/** 设置指定学科的开始日（YYYY-MM-DD）；subjectId 随表单提交。 */
export async function setStartDateAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "");
  if (!subjectId) return { error: "缺少学科" };
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return { error: "学科不存在" };
  const dateStr = String(formData.get("startDate") ?? "");
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { error: "日期无效" };
  await prisma.subject.update({ where: { id: subjectId }, data: { startDate: d } });
  revalidatePath("/admin");
  revalidatePath("/admin/content");
  revalidatePath("/learn");
  return { ok: true };
}

/** 编辑关键词（简介 / 参考考核要点）。 */
export async function updateKeywordAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const id = String(formData.get("keywordId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const referencePoints = String(formData.get("referencePoints") ?? "").trim();
  if (!id) return { error: "缺少关键词" };
  await prisma.keyword.update({
    where: { id },
    data: { description: description || null, referencePoints: referencePoints || null },
  });
  revalidatePath("/admin/content");
  return { ok: true };
}

/** 重新生成某关键词的手绘配图，保存到 public/keyword-illustrations/<keywordId>.png。 */
export async function regenerateKeywordIllustrationAction(
  keywordId: string,
): Promise<AdminState> {
  await requireAdmin();
  if (!keywordId) return { error: "缺少关键词" };

  const keyword = await prisma.keyword.findUnique({
    where: { id: keywordId },
    select: { id: true, term: true, description: true, referencePoints: true },
  });
  if (!keyword) return { error: "关键词不存在" };

  const out = keywordIllustrationFilePath(keyword.id);
  await mkdir(dirname(out), { recursive: true });

  const script = join(process.cwd(), "scripts", "openai-image.sh");
  const prompt = buildKeywordIllustrationPrompt({
    term: keyword.term,
    description: keyword.description,
    referencePoints: keyword.referencePoints,
  });

  try {
    await execFileAsync(
      "bash",
      [
        script,
        "generate",
        "--model",
        "gpt-image-2",
        "--size",
        "1536x1024",
        "--prompt",
        prompt,
        "--out",
        out,
      ],
      { timeout: 180_000, maxBuffer: 1024 * 1024 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "生成失败";
    return { error: msg };
  }

  revalidatePath("/admin/content");
  revalidatePath("/learn/keyword/[id]", "page");
  return { ok: true, path: `/keyword-illustrations/${keyword.id}.png` };
}

/** 新建空学科。 */
export async function createSubjectAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "请填写学科名称" };
  const exists = await prisma.subject.findUnique({ where: { title } });
  if (exists) return { error: "学科名称已存在" };
  await prisma.subject.create({ data: { title } });
  revalidatePath("/admin/content");
  return { ok: true };
}

/** 给空学科批量导入内容（JSON：{chapters:[{index,title,theme,keywords:[{term,description?,referencePoints?}]}]}）。 */
export async function importSubjectContentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "");
  const jsonText = String(formData.get("json") ?? "");
  if (!subjectId) return { error: "缺少学科" };

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { error: "JSON 解析失败，请检查格式" };
  }
  const chapters = (data as { chapters?: unknown })?.chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return { error: "JSON 需包含非空的 chapters 数组" };
  }
  for (const ch of chapters as Record<string, unknown>[]) {
    if (typeof ch.index !== "number" || !ch.title || !Array.isArray(ch.keywords)) {
      return { error: "章节结构不完整（需 index 数字、title、keywords 数组）" };
    }
  }
  const existing = await prisma.chapter.count({ where: { subjectId } });
  if (existing > 0) return { error: "该学科已有章节；请新建一个空学科再导入" };

  for (const ch of chapters as Record<string, unknown>[]) {
    const chapter = await prisma.chapter.create({
      data: {
        subjectId,
        index: ch.index as number,
        title: String(ch.title),
        theme: String(ch.theme ?? ""),
      },
    });
    const kws = (ch.keywords as Record<string, unknown>[]).filter((k) => k?.term);
    await prisma.keyword.createMany({
      data: kws.map((k, i) => ({
        chapterId: chapter.id,
        term: String(k.term),
        description: k.description ? String(k.description) : null,
        referencePoints: k.referencePoints ? String(k.referencePoints) : null,
        orderIndex: i,
      })),
    });
  }
  revalidatePath("/admin/content");
  return { ok: true };
}
