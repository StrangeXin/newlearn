import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  homePathForRole,
  passwordChangeRequired,
} from "@/lib/auth/user";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(
      user.mustChangePassword && passwordChangeRequired()
        ? "/change-password"
        : homePathForRole(user.role),
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-float-in">
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-extrabold text-ink"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base text-white">
              智
            </span>
            <span className="text-2xl">智学闯关</span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-ink">登录，继续闯关</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">
            用下面的演示账号一键体验，或用名单里的姓名 + 默认密码登录。
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          名单里没你的名字，或忘了密码？联系管理员。
        </p>
      </div>
    </main>
  );
}
