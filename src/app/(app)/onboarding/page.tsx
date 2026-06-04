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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="animate-float-in">
        <h1 className="text-2xl font-extrabold text-ink">先认识一下你 👋</h1>
        <p className="mt-2 text-sm text-muted">
          花一分钟填几项资料。系统会据此为你量身定制追问，让 AI
          知识更贴合你的岗位、真正用到工作里——而不是照本宣科。
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-xl shadow-brand-600/5">
        <OnboardingForm />
      </div>
    </main>
  );
}
