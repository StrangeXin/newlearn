import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
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
