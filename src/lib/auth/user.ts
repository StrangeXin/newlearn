import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { EmployeeProfile, User } from "@/generated/prisma/client";
import { getSessionPayload } from "./session";

/** 当前登录用户（无会话或用户不存在返回 null）。 */
export async function getCurrentUser(): Promise<User | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId } });
}

/** 要求已登录，否则跳登录页。 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 要求管理员/超管，否则跳员工首页。 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") redirect("/learn");
  return user;
}

/** 要求超管，否则跳管理后台。 */
export async function requireSuperadmin(): Promise<User> {
  const user = await requireAdmin();
  if (user.role !== "SUPERADMIN") redirect("/admin");
  return user;
}

/**
 * 要求已登录；**员工**还须已填 onboarding 资料（否则跳 /onboarding），管理员/超管放行
 * （管理员无资料时打分上下文自然降级为通用，见 PRD §14.1 / §15.5）。
 * 用于学习地图、排行榜等「员工为主、管理员可旁观参与」的页面，集中这道门禁。
 */
export async function requireUserOnboarded(): Promise<User> {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) redirect("/onboarding");
  }
  return user;
}

/**
 * 要求已登录且**任何角色**都已填资料（否则跳 /onboarding），并返回该资料。
 * 用于「我的资料 / 成长 / 兑换」等需要本人资料的页面（PRD §15.5：管理员也得先填资料）。
 */
export async function requireProfile(): Promise<{ user: User; profile: EmployeeProfile }> {
  const user = await requireUser();
  const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");
  return { user, profile };
}

export function homePathForRole(role: string): string {
  return role === "EMPLOYEE" ? "/learn" : "/admin";
}

/** 是否强制首登改密。设 REQUIRE_PASSWORD_CHANGE=false 可临时关闭（默认开启）。 */
export function passwordChangeRequired(): boolean {
  return process.env.REQUIRE_PASSWORD_CHANGE !== "false";
}

export function roleLabel(role: string): string {
  return role === "SUPERADMIN" ? "超级管理员" : role === "ADMIN" ? "管理员" : "员工";
}
