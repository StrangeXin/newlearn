import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/user";
import { getLearnerDetail, type LearnerRecord } from "@/lib/stats";
import { GrowthTimeline, PortraitCard } from "@/components/growth-timeline";
import { ExpandableText } from "@/components/expandable-text";
import { Markdown } from "@/components/markdown";

function scoreBadge(score: number) {
  const cls = score >= 85 ? "badge-gold" : score >= 60 ? "badge-success" : "badge-muted";
  return <span className={`badge ${cls}`}>{score} 分</span>;
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-ink">{value || "—"}</div>
    </div>
  );
}

function RecordCard({ r }: { r: LearnerRecord }) {
  return (
    <details className="details-chevron card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="badge badge-brand shrink-0">第 {r.chapterIndex} 章</span>
          <span className="truncate font-medium text-ink">{r.term}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {scoreBadge(r.score)}
          <span className="rc" aria-hidden />
        </span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4">
        <div>
          <div className="mb-1 text-xs font-semibold text-muted">笔记</div>
          <div className="rounded-xl bg-surface-2 p-3">
            <ExpandableText text={r.note} markdown controls={false} />
          </div>
        </div>
        {r.followups.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-muted">追问与回答</div>
            {r.followups.map((f, j) => (
              <div key={j} className="rounded-xl border border-line p-3">
                <p className="text-sm font-medium text-ink">
                  <span className="badge badge-brand mr-2">追问 {j + 1}</span>
                  {f.question}
                </p>
                <div className="mt-1.5">
                  <ExpandableText
                    text={f.answer.trim() ? f.answer : "（未作答）"}
                    className="text-muted"
                    controls={false}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {r.feedback && (
          <div className="rounded-xl bg-brand-50 p-3">
            <div className="mb-1 text-xs font-semibold text-brand-700">AI 反馈</div>
            <Markdown>{r.feedback}</Markdown>
          </div>
        )}
      </div>
    </details>
  );
}

export default async function AdminLearnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const { subject } = await searchParams;
  const detail = await getLearnerDetail(userId);
  if (!detail) notFound();
  const backHref = subject ? `/admin/learners?subject=${subject}` : "/admin/learners";

  // 答题记录按学科分组（records 已按 学科→章→分 排序，分组保序）
  const recordGroups: { title: string; items: LearnerRecord[] }[] = [];
  for (const r of detail.records) {
    let g = recordGroups.find((x) => x.title === r.subjectTitle);
    if (!g) {
      g = { title: r.subjectTitle, items: [] };
      recordGroups.push(g);
    }
    g.items.push(r);
  }

  return (
    <main className="page-narrow py-8">
      <Link href={backHref} className="text-sm font-medium text-muted transition hover:text-brand-700">
        ← 员工学情
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-extrabold text-ink">
          {detail.name}
          {detail.profile?.position && (
            <span className="ml-2 align-middle text-base font-medium text-muted">
              {detail.profile.position}
            </span>
          )}
          {!detail.isActivated && <span className="ml-2 align-middle badge badge-muted">未激活</span>}
        </h1>
      </div>

      {/* 账号钱包（统一钱包，跨学科） */}
      <div className="mt-4 grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="card p-3 text-center">
          <div className="text-xs text-muted">累计获得</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-accent-700">
            {detail.wallet.earned}
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-muted">已兑换</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {detail.wallet.redeemed}
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-muted">当前余额</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {detail.wallet.balance}
          </div>
        </div>
      </div>

      {/* 跨学科进度 */}
      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">学习进度</h2>
        {detail.subjects.length === 0 ? (
          <p className="card p-5 text-sm text-muted">暂无已上线学科。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.subjects.map((s) => {
              const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              return (
                <div key={s.subjectId} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{s.title}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {s.completed}/{s.total}
                    </span>
                  </div>
                  <div className="progress mt-2 h-2">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted">
                    <span>
                      均分 <span className="font-semibold text-ink">{s.avgScore || "—"}</span>
                    </span>
                    <span>
                      积分 <span className="font-semibold text-ink">{s.points}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 资料 */}
      {detail.profile && (
        <section className="mt-7">
          <h2 className="mb-3 font-bold text-ink">基本资料</h2>
          <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
            <ProfileField label="岗位" value={detail.profile.position} />
            <ProfileField label="部门" value={detail.profile.department} />
            <ProfileField label="职级 / 年限" value={detail.profile.level} />
            <ProfileField label="专业背景" value={detail.profile.background} />
            <ProfileField label="对 AI 熟悉度" value={detail.profile.aiFamiliarity} />
            <ProfileField label="想用 AI 做" value={detail.profile.applicationAreas} />
          </div>
        </section>
      )}

      {/* 完整画像（不脱敏） */}
      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-ink">学习画像</h2>
          {detail.memory && (
            <span className="text-xs text-muted">已更新 {detail.memory.updateCount} 次</span>
          )}
        </div>
        {detail.memory ? (
          <PortraitCard tags={detail.memory.tags} portrait={detail.memory.portrait} />
        ) : (
          <p className="card p-5 text-sm text-muted">该员工还没有画像（通过第一个关键词后生成）。</p>
        )}
      </section>

      {/* 成长轨迹 */}
      {detail.snapshots.length > 0 && (
        <section className="mt-9">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-ink">成长轨迹</h2>
            <span className="badge badge-muted">共 {detail.snapshots.length} 次</span>
          </div>
          <GrowthTimeline snapshots={detail.snapshots} />
        </section>
      )}

      {/* 逐词答题记录 */}
      <section className="mt-9">
        <h2 className="mb-3 font-bold text-ink">
          答题记录
          <span className="ml-2 text-sm font-normal text-muted">
            共 {detail.records.length} 词
          </span>
        </h2>
        {recordGroups.length === 0 ? (
          <p className="card p-5 text-sm text-muted">还没有已通关的关键词。</p>
        ) : (
          <div className="space-y-6">
            {recordGroups.map((g) => (
              <div key={g.title}>
                {recordGroups.length > 1 && (
                  <h3 className="mb-2 text-sm font-semibold text-muted">{g.title}</h3>
                )}
                <div className="space-y-2.5">
                  {g.items.map((r) => (
                    <RecordCard key={r.keywordId} r={r} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
