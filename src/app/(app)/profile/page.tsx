import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { parseTags } from "@/lib/memory-diff";
import { ProfileEditForm } from "./profile-edit-form";

function Chips({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return <span className="text-xs text-muted">（暂无）</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/admin");

  const [profile, memory] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId: user.id } }),
    prisma.employeeMemory.findUnique({ where: { userId: user.id } }),
  ]);
  if (!profile) redirect("/onboarding");

  const tags = parseTags(memory?.tags);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="animate-float-in flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">我的资料</h1>
        <Link
          href="/growth"
          className="rounded-xl border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
        >
          查看成长轨迹 →
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-ink">基本资料（可编辑）</h2>
        <ProfileEditForm
          values={{
            position: profile.position,
            department: profile.department,
            level: profile.level,
            background: profile.background,
            aiFamiliarity: profile.aiFamiliarity,
            applicationAreas: profile.applicationAreas,
          }}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink">🤖 AI 对你的画像</h2>
          <span className="text-xs text-muted">由系统维护，只读</span>
        </div>
        {memory && memory.updateCount > 0 ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="text-xs font-medium text-muted">掌握强项</div>
              <div className="mt-1">
                <Chips items={tags.strengths} color="bg-success-500/15 text-success-500" />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted">待加强 / 盲区</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chips items={[...tags.weaknesses, ...tags.blindSpots]} color="bg-accent-500/15 text-accent-500" />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted">兴趣方向</div>
              <div className="mt-1">
                <Chips items={tags.interests} color="bg-brand-100 text-brand-700" />
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-brand-700">
                查看完整画像（Markdown）
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-relaxed text-ink">
                {memory.portrait}
              </pre>
            </details>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            完成第一个关键词后，AI 就会开始为你画像。去
            <Link href="/learn" className="text-brand-700 underline">
              闯关
            </Link>
            吧！
          </p>
        )}
      </section>
    </main>
  );
}
