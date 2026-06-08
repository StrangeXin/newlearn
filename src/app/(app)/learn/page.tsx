import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserOnboarded } from "@/lib/auth/user";
import { getScheduleInfo, isCycleEnded } from "@/lib/schedule";
import { ACTIVE_SUBJECT_WHERE, SUBJECT_ORDER } from "@/lib/subject";

// 学科选择页：平台可同时上线多个学习主题，员工在此挑选要学的学科。
// 仅一个学科时直接进入其闯关地图；无学科时空态。
export default async function LearnHomePage() {
  const user = await requireUserOnboarded();

  const subjects = await prisma.subject.findMany({
    where: ACTIVE_SUBJECT_WHERE,
    orderBy: SUBJECT_ORDER,
    include: {
      chapters: { select: { _count: { select: { keywords: true } } } },
    },
  });

  if (subjects.length === 0) {
    return (
      <main className="page py-8">
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
            📚
          </span>
          <h1 className="mt-5 text-xl font-bold text-ink">还没有开课</h1>
          <p className="mt-2 max-w-sm text-muted">管理员开启学科后，这里会列出可学习的主题。</p>
        </div>
      </main>
    );
  }

  // 仅一个学科：直接进入，省去一次点击
  if (subjects.length === 1) {
    redirect(`/learn/${subjects[0].id}`);
  }

  const ids = subjects.map((s) => s.id);
  const [completed, points] = await Promise.all([
    prisma.keywordProgress.groupBy({
      by: ["subjectId"],
      where: { userId: user.id, subjectId: { in: ids }, isCompleted: true },
      _count: { _all: true },
    }),
    prisma.pointsLedger.groupBy({
      by: ["subjectId"],
      where: { userId: user.id, subjectId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);
  const doneMap = new Map(completed.map((c) => [c.subjectId, c._count._all]));
  const ptMap = new Map(points.map((p) => [p.subjectId, p._sum.amount ?? 0]));

  return (
    <main className="page py-8">
      <div className="animate-float-in">
        <p className="text-sm text-muted">欢迎回来</p>
        <h1 className="mt-0.5 text-3xl font-extrabold text-ink">{user.name}</h1>
        <p className="mt-2 text-muted">
          当前有 <span className="font-semibold text-brand-700">{subjects.length}</span> 个学习主题，挑一个开始闯关。
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {subjects.map((s) => {
          const total = s.chapters.reduce((sum, c) => sum + c._count.keywords, 0);
          const done = doneMap.get(s.id) ?? 0;
          const pts = ptMap.get(s.id) ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const schedule = getScheduleInfo(s);
          const ended = isCycleEnded(s, s.chapters.length);
          return (
            <Link
              key={s.id}
              href={`/learn/${s.id}`}
              className="card-link flex flex-col p-6 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold text-ink">{s.title}</h2>
                  <p className="mt-1.5 text-sm text-muted">
                    共 {s.chapters.length} 章 / {total} 关键词
                    {ended ? (
                      <> · 培训已结束 · 可补学</>
                    ) : schedule.started ? (
                      <> · 已开课第 {schedule.currentWeek} 周</>
                    ) : (
                      <> · 未开课</>
                    )}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-xl bg-accent-100 px-3 py-1.5 text-sm font-extrabold tabular-nums text-accent-700">
                  <span aria-hidden>🏅</span>
                  {pts}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="progress flex-1">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
                  {done}/{total}
                </span>
              </div>

              <span className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
                {done > 0 ? "继续闯关" : "开始闯关"} →
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
