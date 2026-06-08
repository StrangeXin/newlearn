import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth/user";
import { parseTags } from "@/lib/memory-diff";
import { ExpandableText } from "@/components/expandable-text";
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
  const { user, profile } = await requireProfile();
  const memory = await prisma.employeeMemory.findUnique({ where: { userId: user.id } });

  const tags = parseTags(memory?.tags);
  const hasPortrait = !!memory && memory.updateCount > 0;
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];

  return (
    <main className="page-narrow py-8">
      <div className="animate-float-in">
        <h1 className="text-2xl font-bold text-ink">我的资料</h1>
        <p className="mt-1.5 max-w-prose leading-relaxed text-muted">
          上半是你填的基本资料，决定追问怎么问；下半是系统按你的作答写的画像，只读。
        </p>
      </div>

      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">基本资料</h2>
          <span className="text-xs text-muted">改了即时生效</span>
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
          <h2 className="text-lg font-semibold text-ink">画像</h2>
          <span className="badge badge-muted">系统维护 · 只读</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {hasPortrait
            ? `已根据 ${memory.updateCount} 次作答整理。`
            : "通过关键词后，会从你的作答里提炼这张画像。"}
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
            <div>
              <div className="field-label">画像全文</div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <ExpandableText markdown text={memory.portrait} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-xs text-muted">想看它一步步变清晰的过程？</span>
              <Link href="/growth" className="btn btn-secondary btn-sm shrink-0">
                看成长轨迹 →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-line bg-surface px-5 py-8 text-center">
            <p className="mx-auto max-w-sm leading-relaxed text-muted">
              通过第一个关键词后，画像就会出现在这里。
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
