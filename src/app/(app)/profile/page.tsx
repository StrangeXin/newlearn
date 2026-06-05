import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { parseTags } from "@/lib/memory-diff";
import { ProfileEditForm } from "./profile-edit-form";

function Chips({ items, badge }: { items: string[]; badge: string }) {
  if (items.length === 0)
    return <span className="text-sm text-muted">尚未识别，多答几个词就有了</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`badge ${badge}`}>
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
  const hasPortrait = !!memory && memory.updateCount > 0;
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];

  return (
    <main className="page-narrow py-8">
      <div className="animate-float-in">
        <h1 className="text-2xl font-bold text-ink">我的资料</h1>
        <p className="mt-1.5 max-w-prose leading-relaxed text-muted">
          这里有两部分：上面是你填的基本资料，AI 用它来调整追问的角度；下面是 AI
          边批改边写下的画像，只读，会越来越懂你。
        </p>
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">基本资料</h2>
          <span className="text-xs text-muted">改了即时生效，下次追问就会参考</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          换了岗位或想把 AI 用在新场景，随时来改。
        </p>
        <div className="mt-5">
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
        </div>
      </section>

      <section className="panel mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">AI 对你的画像</h2>
          <span className="badge badge-muted">系统维护 · 只读</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {hasPortrait
            ? `已根据你的 ${memory.updateCount} 个关键词作答整理出来，每通过一个词就会更新一次。`
            : "提交并通过关键词后，AI 会从你的作答里提炼这张画像。"}
        </p>

        {hasPortrait ? (
          <div className="mt-5 space-y-5 text-sm">
            <div>
              <div className="field-label">掌握强项</div>
              <Chips items={tags.strengths} badge="badge-success" />
            </div>
            <div>
              <div className="field-label">待加强 / 盲区</div>
              <Chips items={weaknesses} badge="badge-muted" />
            </div>
            <div>
              <div className="field-label">兴趣方向</div>
              <Chips items={tags.interests} badge="badge-brand" />
            </div>
            <details className="rounded-xl border border-line bg-surface">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-brand-700">
                展开完整画像
              </summary>
              <pre className="whitespace-pre-wrap border-t border-line px-3 py-3 font-mono text-xs leading-relaxed text-ink">
                {memory.portrait}
              </pre>
            </details>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-xs text-muted">想看它一步步变清晰的过程？</span>
              <Link href="/growth" className="btn btn-secondary btn-sm shrink-0">
                成长轨迹 →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-line bg-surface px-5 py-8 text-center">
            <p className="mx-auto max-w-sm leading-relaxed text-muted">
              答完第一个关键词，这里就会出现你的第一张画像，之后每答一词都会更新。
            </p>
            <Link href="/learn" className="btn btn-primary mt-4">
              去闯关 →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
