import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { getChapterRanking } from "@/lib/ranking";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";
import { SettleButton } from "./settle-button";

const medal = ["🥇", "🥈", "🥉"];

export default async function AdminRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  await requireAdmin();
  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/admin");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: subject.id },
    orderBy: { index: "asc" },
  });

  const rankings = await Promise.all(
    chapters.map((ch) => getChapterRanking(subject.id, ch.id, ch.index)),
  );

  // 概览：已结算的章数、已入榜人次、已发 +100 的人次（仅读已结算数据，不触发结算）
  const settledChapters = rankings.filter((rows) => rows.length > 0).length;
  const rankedCount = rankings.reduce((s, rows) => s + rows.length, 0);
  const bonusCount = rankings.reduce(
    (s, rows) => s + rows.filter((r) => r.bonusAwarded).length,
    0,
  );

  return (
    <main className="page py-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">章节排名结算</h1>
      <p className="mt-1.5 mb-4 text-sm leading-relaxed text-muted">
        {subject.title} · 完成本章全部 20 词的员工才入榜，按 20 词均分排序。前 3 名各得 +100，并列同样各给 +100（不稀释、不限人数）。结算一次性，重复点不会重复发奖。
      </p>
      <SubjectTabs subjects={subjects} activeId={subject.id} basePath="/admin/rankings" />

      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="card p-3.5">
          <div className="text-xs font-medium text-muted">已结算章节</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-ink">
            {settledChapters}
            <span className="text-sm font-semibold text-muted">/{chapters.length}</span>
          </div>
        </div>
        <div className="card p-3.5">
          <div className="text-xs font-medium text-muted">已入榜人次</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-ink">{rankedCount}</div>
        </div>
        <div className="card p-3.5">
          <div className="text-xs font-medium text-muted">已发 +100</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-accent-700">{bonusCount}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        {chapters.map((ch, i) => {
          const rows = rankings[i];
          const settled = rows.length > 0;
          return (
            <section key={ch.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-ink">
                    第 {ch.index} 章 · {ch.title}
                  </h2>
                  <div className="mt-1">
                    {settled ? (
                      <span className="badge badge-success">已结算 · {rows.length} 人入榜</span>
                    ) : (
                      <span className="badge badge-muted">未结算</span>
                    )}
                  </div>
                </div>
                <SettleButton chapterId={ch.id} />
              </div>
              {!settled ? (
                <p className="px-5 py-6 text-sm leading-relaxed text-muted">
                  还没人完成本章全部 20 词，暂无排名。
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-line px-5 py-2 text-xs font-medium text-muted">
                    <span className="w-7 shrink-0 text-center">名次</span>
                    <span className="flex-1">姓名</span>
                    <span className="shrink-0">20 词均分</span>
                  </div>
                  <ul>
                    {rows.map((r) => {
                      const isTop3 = r.rank <= 3;
                      return (
                        <li
                          key={r.userId}
                          className="flex items-center gap-3 border-b border-line px-5 py-2.5 text-sm last:border-b-0"
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                              isTop3 ? "bg-accent-100 text-accent-700" : "text-muted"
                            }`}
                            aria-hidden
                          >
                            {isTop3 ? medal[r.rank - 1] : r.rank}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium text-ink">
                            {r.name}
                          </span>
                          {r.bonusAwarded && (
                            <span className="badge badge-gold shrink-0">🏅 +100</span>
                          )}
                          <span className="shrink-0 tabular-nums font-semibold text-ink">
                            {r.avgScore.toFixed(1)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
