import { requireUser } from "@/lib/auth/user";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  const forced = user.mustChangePassword;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-float-in">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-brand-700">
            {forced ? "首次登录 · 请设置新密码" : "修改密码"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {forced
              ? "为了账号安全，请把默认密码改成只有你知道的密码。"
              : "设置一个新的密码。"}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-xl shadow-brand-600/5">
          <ChangePasswordForm forced={forced} />
        </div>
      </div>
    </main>
  );
}
