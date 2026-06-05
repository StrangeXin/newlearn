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
            你的姓名已在员工名单里。用姓名加默认密码登录即激活账号，首次登录会让你改成只有自己知道的密码。
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <LoginForm />
        </div>

        <ul className="mt-5 space-y-1.5 text-center text-xs text-muted">
          <li>每周一章，提交笔记后 AI 打分并追问</li>
          <li>
            通过一个关键词得 <span className="font-semibold text-accent-700">1 积分</span>
            ，可兑换书籍和工具，每章前三名另奖 100 分
          </li>
        </ul>

        <p className="mt-4 text-center text-xs text-muted">
          姓名不在名单里，或忘了密码？请联系管理员。
        </p>
      </div>
    </main>
  );
}
