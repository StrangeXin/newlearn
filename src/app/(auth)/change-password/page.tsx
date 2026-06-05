import { requireUser } from "@/lib/auth/user";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-float-in">
        <div className="mb-7 text-center">
          {forced && (
            <span className="badge badge-brand mb-3">首次登录</span>
          )}
          <h1 className="text-2xl font-bold text-ink">
            {forced ? "设置你的专属密码" : "修改密码"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {forced
              ? "默认密码全员相同，别人也能用它进你的账号。改成只有你知道的密码，这一步过后就能开始闯关。"
              : "设置一个新密码，下次登录用它。"}
          </p>
        </div>

        <div className="card p-6 sm:p-7">
          <ChangePasswordForm forced={forced} />
        </div>
      </div>
    </main>
  );
}
