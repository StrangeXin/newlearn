import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  // 任何角色都可填资料参与学习；已填过的直接进闯关页
  const existing = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) redirect("/learn");

  return (
    <main className="page-narrow py-10">
      <div className="animate-float-in">
        <span className="badge badge-brand">第 1 步 · 认识你</span>
        <h1 className="mt-3 text-2xl font-bold text-ink">先聊聊，{user.name}</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-muted">
          填一下你的岗位、背景和想用 AI 解决的问题。后续追问会按这些定制，而不是通用模板。
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            追问贴着你的岗位问
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            答得越多，记得越准
          </li>
          <li className="flex items-center gap-1.5">
            <span className="text-brand-600" aria-hidden>
              ✓
            </span>
            随时能改
          </li>
        </ul>
      </div>

      <div className="card mt-6 p-6 sm:p-7">
        <OnboardingForm />
      </div>
    </main>
  );
}
