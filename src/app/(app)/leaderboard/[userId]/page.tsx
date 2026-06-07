import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { getPeerRecords } from "@/lib/social";
import { getActiveSubjects } from "@/lib/subject";
import { ExpandableText } from "@/components/expandable-text";

function PeerChips({ items, badge }: { items: string[]; badge: string }) {
  if (items.length === 0) return <span className="text-sm text-muted">暂无</span>;
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

export default async function PeerRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { userId } = await params;
  const me = await requireUser();
  if (me.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: me.id } });
    if (!profile) redirect("/onboarding");
  }

  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/learn");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];
  const backHref = `/leaderboard?subject=${subject.id}`;

  const data = await getPeerRecords(me.id, userId, subject.id);
  if (!data) redirect(backHref);

  const isMe = userId === me.id;
  const locked = data.totalCompleted - data.unlockedCount;

  return (
    <main className="page-narrow py-8">
      <Link
        href={backHref}
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 排行榜
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-extrabold text-ink">
          {data.name}
          {isMe && <span className="ml-2 align-middle badge badge-brand">你</span>}
          <span className="ml-2 align-middle text-base font-medium text-muted">的闯关记录</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          已通关 <span className="font-semibold text-ink">{data.totalCompleted}</span> 词 · 均分{" "}
          <span className="font-semibold text-accent-700">{data.avgScore.toFixed(2)}</span>
          {!isMe && locked > 0 && (
            <> · 其中 {locked} 词你还没完成，先去通关才能看 ta 的写法</>
          )}
        </p>
      </div>

      {data.growth && (
        <section className="mt-7">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-ink">当前画像</h2>
            <span className="text-xs text-muted">系统按 ta 的作答整理</span>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="field-label">掌握强项</div>
                <PeerChips items={data.growth.strengths} badge="badge-success" />
              </div>
              <div>
                <div className="field-label">兴趣方向</div>
                <PeerChips items={data.growth.interests} badge="badge-brand" />
              </div>
            </div>
            {data.growth.portrait && (
              <div className="mt-5">
                <div className="field-label">画像</div>
                <div className="rounded-xl border border-line bg-surface-2 p-4">
                  <ExpandableText markdown text={data.growth.portrait} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <h2 className="mb-3 mt-8 font-bold text-ink">闯关记录</h2>
      {data.items.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-muted">
          ta 还没有已通关的关键词。
        </div>
      ) : (
        <ul className="space-y-2.5">
          {data.items.map((it) => (
            <li key={it.keywordId} className="card overflow-hidden">
              {it.unlocked ? (
                <details className="[&[open]>summary>.rc]:rotate-180">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="badge badge-brand shrink-0">第 {it.chapterIndex} 章</span>
                      <span className="truncate font-medium text-ink">{it.term}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="badge badge-success">{it.score} 分</span>
                      <span className="rc text-xs text-muted transition-transform" aria-hidden>
                        ▾
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-line px-4 py-4">
                    <div>
                      <div className="mb-1 text-xs font-semibold text-muted">笔记</div>
                      <div className="rounded-xl bg-surface-2 p-3">
                        <ExpandableText text={it.note ?? ""} markdown />
                      </div>
                    </div>
                    {it.followups && it.followups.length > 0 && (
                      <div className="space-y-2.5">
                        <div className="text-xs font-semibold text-muted">追问与回答</div>
                        {it.followups.map((f, j) => (
                          <div key={j} className="rounded-xl border border-line p-3">
                            <p className="text-sm font-medium text-ink">
                              <span className="badge badge-brand mr-2">追问 {j + 1}</span>
                              {f.question}
                            </p>
                            <div className="mt-1.5">
                              <ExpandableText
                                text={f.answer.trim() ? f.answer : "（未作答）"}
                                className="text-muted"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="badge badge-muted shrink-0">第 {it.chapterIndex} 章</span>
                    <span className="truncate font-medium text-ink">{it.term}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="badge badge-success">{it.score} 分</span>
                    <Link
                      href={`/learn/keyword/${it.keywordId}`}
                      className="text-xs font-medium text-brand-700 transition hover:text-brand-600"
                    >
                      完成本词后可见 →
                    </Link>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
