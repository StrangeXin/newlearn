import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  // 管理员无需填资料；已填过的直接进首页
  if (user.role !== "EMPLOYEE") redirect("/admin");
  const existing = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) redirect("/learn");

  return (
    <main className="page-narrow py-10">
      <div className="animate-float-in">
        <span className="badge badge-brand">第 1 步 · 认识你</span>
        <h1 className="mt-3 text-2xl font-bold text-ink">先认识一下你，{user.name}</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-muted">
          填写你的岗位、背景和想用 AI 解决的问题，之后 AI 的追问会结合你的实际工作，而不是套用通用模板。
          填完即可进入第 1 关。
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            追问贴你的岗位
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            画像随学习自动更新
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            资料随时可改
          </li>
        </ul>
      </div>

      <div className="card mt-6 p-6 sm:p-7">
        <OnboardingForm />
      </div>
    </main>
  );
}
