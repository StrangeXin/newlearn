import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homePathForRole } from "@/lib/auth/user";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.mustChangePassword ? "/change-password" : homePathForRole(user.role));
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-float-in">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-extrabold text-brand-700">
            智学闯关
          </Link>
          <p className="mt-2 text-sm text-muted">
            输入姓名与密码即可开始。首次登录用默认密码，登录后请尽快修改。
          </p>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-xl shadow-brand-600/5">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          忘记密码或不在名单中？请联系管理员。
        </p>
      </div>
    </main>
  );
}
