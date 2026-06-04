import bcrypt from "bcryptjs";
import { z } from "zod";

/** 新密码策略：8–72 位，至少含字母与数字。 */
export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 位")
  .max(72, "密码不能超过 72 位")
  .regex(/[A-Za-z]/, "密码需包含字母")
  .regex(/[0-9]/, "密码需包含数字");

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
