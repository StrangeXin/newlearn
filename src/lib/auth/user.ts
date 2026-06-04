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

export function homePathForRole(role: string): string {
  return role === "EMPLOYEE" ? "/learn" : "/admin";
}

export function roleLabel(role: string): string {
  return role === "SUPERADMIN" ? "超级管理员" : role === "ADMIN" ? "管理员" : "员工";
}
