import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { getScheduleInfo } from "@/lib/schedule";
import { getFinanceStats, getProgressOverview, getQualityStats } from "@/lib/stats";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center shadow-sm">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export default async function AdminStatsPage() {
  await requireAdmin();
  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    include: { activeSubject: { select: { title: true, startDate: true } } },
  });
  if (!cfg?.activeSubjectId) redirect("/admin");
  const sid = cfg.activeSubjectId;

  const [progress, quality, finance] = await Promise.all([
    getProgressOverview(sid),
    getQualityStats(sid),
    getFinanceStats(sid),
  ]);
  const week = getScheduleInfo(cfg.activeSubject).currentWeek;
  const maxDist = Math.max(1, ...quality.distribution.map((d) => d.count));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">数据统计</h1>
      <p className="mt-1 text-sm text-muted">
        学科：{cfg.activeSubject?.title} · 当前第 {week} 周
      </p>

      {/* 财务 */}
      <section className="mt-6">
        <h2 className="mb-2 font-bold text-ink">💰 积分与兑换</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="累计发放积分" value={finance.issued} />
          <Stat label="已兑换(元)" value={finance.redeemed} sub={`${finance.approvedCount} 笔已通过`} />
          <Stat label="在册余额" value={finance.balance} />
          <Stat label="待审批" value={finance.pendingCount} sub={`${finance.pendingAmount} 元`} />
        </div>
      </section>

      {/* 质量 */}
      <section className="mt-6">
        <h2 className="mb-2 font-bold text-ink">📊 分数质量</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="平均最终分" value={quality.avgScore} />
          <Stat label="已通过词次" value={quality.completedCount} />
        </div>
        <div className="mt-3 rounded-2xl border border-brand-100 bg-white/80 p-4">
          <div className="mb-2 text-sm font-medium text-ink">分数分布</div>
          <div className="space-y-1">
            {quality.distribution.map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-muted">{d.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                    style={{ width: `${(d.count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-muted">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
        {quality.hardest.length > 0 && (
          <div className="mt-3 rounded-2xl border border-brand-100 bg-white/80 p-4">
            <div className="mb-2 text-sm font-medium text-ink">最难的关键词（平均分最低）</div>
            <ul className="space-y-1 text-sm">
              {quality.hardest.map((h) => (
                <li key={h.term} className="flex justify-between">
                  <span className="text-ink">{h.term}</span>
                  <span className="text-muted">均分 {h.avg} · {h.count} 人</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 进度 */}
      <section className="mt-6">
        <h2 className="mb-2 font-bold text-ink">🚀 全员进度</h2>
        <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white/80">
          {progress.rows.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="w-24 truncate text-sm font-medium text-ink">{r.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                  style={{ width: `${(r.completed / progress.totalKeywords) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-xs text-muted">
                {r.completed}/{progress.totalKeywords}
              </span>
            </li>
          ))}
        </ul>
        {progress.rows.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            落后提醒：
            {progress.rows
              .filter((r) => r.completed === 0)
              .map((r) => r.name)
              .join("、") || "无（都已开始）"}
          </p>
        )}
      </section>

      <div className="mt-6">
        <Link href="/admin/rankings" className="text-sm text-brand-700 underline">
          查看各章排行榜与 top3 →
        </Link>
      </div>
    </main>
  );
}
