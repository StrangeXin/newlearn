import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/user";
import { getFinanceStats, getLearnerRoster, getQualityStats } from "@/lib/stats";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";

function Stat({
  label,
  value,
  sub,
  gold,
}: {
  label: string;
  value: string | number;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${gold ? "text-accent-700" : "text-ink"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  await requireAdmin();
  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/admin");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];
  const sid = subject.id;

  const [roster, quality, finance] = await Promise.all([
    getLearnerRoster(sid),
    getQualityStats(sid),
    getFinanceStats(),
  ]);
  const week = roster.currentWeek;
  const maxDist = Math.max(1, ...quality.distribution.map((d) => d.count));

  const total = roster.rows.length;
  const startedCount = roster.rows.filter((r) => r.status !== "inactive" && r.completed > 0).length;
  const behindCount = roster.rows.filter((r) => r.behind).length;
  const totalDist = quality.distribution.reduce((s, d) => s + d.count, 0);

  return (
    <main className="page py-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ink">数据统计</h1>

      {/* 财务：统一钱包，全公司口径，与学科无关，放在学科切换之上 */}
      <section className="mt-4">
        <SectionHead
          title="积分与兑换（全公司）"
          hint="统一钱包、跨学科汇总。1 积分 = 1 元报销；在册余额 = 已发 − 已兑；待审批是员工已申请、等你处理的。"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="累计发放积分" value={finance.issued} gold />
          <Stat
            label="已兑现（元）"
            value={finance.redeemed}
            sub={`${finance.approvedCount} 笔已通过`}
          />
          <Stat label="在册余额" value={finance.balance} sub="员工手上未兑换的积分" />
          <Stat
            label="待审批"
            value={finance.pendingCount}
            sub={finance.pendingCount > 0 ? `共 ${finance.pendingAmount} 元待处理` : "暂无申请"}
          />
        </div>
        {finance.pendingCount > 0 && (
          <Link
            href="/admin/redemptions"
            className="mt-3 inline-flex text-sm font-medium text-brand-700 transition hover:text-brand-600"
          >
            去处理 {finance.pendingCount} 笔兑换申请 →
          </Link>
        )}
      </section>

      {/* 按学科：学科切换只管下面这块 */}
      <div className="mt-10 mb-3">
        <h2 className="text-base font-bold text-ink">按学科看</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          下面的分数质量按所选学科统计；逐人进度与画像见「员工学情」。
        </p>
      </div>
      <SubjectTabs subjects={subjects} activeId={sid} basePath="/admin/stats" />
      <p className="mt-3 text-sm text-muted">
        {subject.title} · 第 <span className="tabular-nums">{week}</span> 周 · 全员{" "}
        <span className="tabular-nums">{total}</span> 人 · 已开始{" "}
        <span className="tabular-nums">{startedCount}</span> · 落后{" "}
        <span className="tabular-nums">{behindCount}</span> ·{" "}
        <Link
          href={`/admin/learners?subject=${sid}`}
          className="font-medium text-brand-700 transition hover:text-brand-600"
        >
          员工学情 →
        </Link>
      </p>

      {/* 质量（按学科） */}
      <section className="mt-6">
        <SectionHead
          title="分数质量"
          hint="只看已通过（终评 ≥60）的词次。分数分布看大盘水平，最难关键词帮定位哪些词需要补资料。"
        />
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Stat label="平均最终分" value={quality.avgScore} sub="已通过词次的均分" />
          <Stat label="已通过词次" value={quality.completedCount} sub="全员累计" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="card p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">分数分布</h3>
              <span className="text-xs text-muted">
                共 <span className="tabular-nums">{totalDist}</span> 词次
              </span>
            </div>
            {totalDist === 0 ? (
              <p className="py-4 text-sm leading-relaxed text-muted">
                还没人通过任何关键词。
              </p>
            ) : (
              <div className="space-y-2.5">
                {quality.distribution.map((d) => (
                  <div key={d.label} className="flex items-center gap-3 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-muted">{d.label}</span>
                    <div className="progress h-2.5 flex-1">
                      <span style={{ width: `${(d.count / maxDist) * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums font-medium text-ink">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">最难的关键词</h3>
            {quality.hardest.length === 0 ? (
              <p className="py-4 text-sm leading-relaxed text-muted">
                暂无足够数据。
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {quality.hardest.map((h) => (
                  <li
                    key={h.term}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate font-medium text-ink">{h.term}</span>
                    <span className="shrink-0 text-xs text-muted">
                      均分 <span className="tabular-nums font-semibold text-ink">{h.avg}</span> ·{" "}
                      {h.count} 人
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-5">
        <Link href={`/admin/learners?subject=${sid}`} className="btn btn-secondary btn-sm">
          看逐人学情 →
        </Link>
        <Link href={`/admin/rankings?subject=${sid}`} className="btn btn-secondary btn-sm">
          查看各章排行榜与 top3 发奖 →
        </Link>
      </div>
    </main>
  );
}
