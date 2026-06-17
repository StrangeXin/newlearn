"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { findUserByLoginIdentifier } from "@/lib/auth/identifier";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { getCurrentUser, homePathForRole, passwordChangeRequired } from "@/lib/auth/user";

export interface ActionState {
  error?: string;
}

/** 登录：白名单校验 + 密码核对 + 首登激活；成功后按状态跳转。 */
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "请输入姓名/手机号和密码" };

  const user = await findUserByLoginIdentifier(identifier);
  if (!user) return { error: "账号不存在或密码不正确" };

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "账号不存在或密码不正确" };

  if (!user.isActivated) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActivated: true },
    });
  }

  await createSession(user.id, user.role);
  redirect(
    user.mustChangePassword && passwordChangeRequired()
      ? "/change-password"
      : homePathForRole(user.role),
  );
}

/** 改密：首登强制改密免输当前密码；日常改密需校验当前密码。 */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!user.mustChangePassword) {
    if (!current) return { error: "请输入当前密码" };
    if (!(await verifyPassword(current, user.passwordHash))) {
      return { error: "当前密码不正确" };
    }
  }

  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (next !== confirm) return { error: "两次输入的新密码不一致" };

  const defaultPw = process.env.DEFAULT_PASSWORD ?? "Aa123456!";
  if (next === defaultPw) return { error: "新密码不能与默认密码相同" };
  if (await verifyPassword(next, user.passwordHash)) {
    return { error: "新密码不能与当前密码相同" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  redirect(homePathForRole(user.role));
}

/** 登出。 */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
