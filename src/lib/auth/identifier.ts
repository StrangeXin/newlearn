import { z } from "zod";
import { prisma } from "@/lib/db";

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的 11 位手机号"));

export function normalizeLoginName(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeOptionalPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return phoneSchema.parse(trimmed);
}

export function looksLikePhone(value: string): boolean {
  const normalized = value.trim().replace(/[\s-]/g, "");
  return /^\d+$/.test(normalized);
}

export async function findUserByLoginIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;

  if (looksLikePhone(raw)) {
    const parsed = phoneSchema.safeParse(raw);
    if (!parsed.success) return null;
    return prisma.user.findUnique({ where: { phone: parsed.data } });
  }

  return prisma.user.findUnique({
    where: { loginName: normalizeLoginName(raw) },
  });
}
