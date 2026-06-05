import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { getScheduleInfo, isChapterUnlocked } from "@/lib/schedule";

export default async function LearnPage() {
  const user = await requireUser();
  // 员工首次进来需先填基本资料（onboarding）
  if (user.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) redirect("/onboarding");
  }

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    include: {
      activeSubject: {
        include: {
          chapters: {
            orderBy: { index: "asc" },
            include: { _count: { select: { keywords: true } } },
          },
        },
      },
    },
  });
  const subject = cfg?.activeSubject;

  // 个人进度：各章已通过数 + 积分（按当前学科）
  const [completedByChapter, points] = subject
    ? await Promise.all([
        prisma.keywordProgress.groupBy({
          by: ["chapterId"],
          where: { userId: user.id, subjectId: subject.id, isCompleted: true },
          _count: { _all: true },
        }),
        prisma.pointsLedger.aggregate({
          where: { userId: user.id, subjectId: subject.id },
          _sum: { amount: true },
        }),
      ])
    : [[], { _sum: { amount: null } }];
  const doneMap = new Map(completedByChapter.map((c) => [c.chapterId, c._count._all]));
  const totalDone = completedByChapter.reduce((s, c) => s + c._count._all, 0);
  const totalPoints = points._sum.amount ?? 0;
  const schedule = getScheduleInfo(subject ?? null);

  // 章节状态 + 聚焦（本周任务 / 补做 / 全通关）
  const chapters = subject?.chapters ?? [];
  const states = chapters.map((ch) => {
    const done = doneMap.get(ch.id) ?? 0;
    const total = ch._count.keywords;
    const unlocked = subject ? isChapterUnlocked(subject, ch.index) : false;
    return {
      ch,
      done,
      total,
      unlocked,
      fullyDone: unlocked && total > 0 && done >= total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });
  const currentIndex =
    subject && schedule.started ? Math.min(schedule.currentWeek, chapters.length) : 0;
  const weekState = states.find((s) => s.ch.index === currentIndex);
  const focus =
    weekState && weekState.unlocked && !weekState.fullyDone
      ? weekState
      : (states.find((s) => s.unlocked && !s.fullyDone) ?? null);
  const focusIsWeek = !!focus && focus.ch.index === currentIndex;
  const allUnlockedDone = !focus && states.some((s) => s.unlocked);
  const nextLockedIndex = states.find((s) => !s.unlocked)?.ch.index ?? null;

  return (
    <main className="page py-8">
      <div className="animate-float-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">欢迎回来</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-ink">{user.name}</h1>
          {subject ? (
            <p className="mt-2 text-muted">
              当前学科 <span className="font-semibold text-brand-700">{subject.title}</span>
              {schedule.started && (
                <>
                  {" · "}已开课第{" "}
                  <span className="font-semibold text-brand-700">{schedule.currentWeek}</span> 周，
                  本周开放到第 {Math.min(schedule.currentWeek, chapters.length)} 关
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-muted">管理员还没开课，耐心等一下。</p>
          )}
        </div>
        {subject && (
          <div className="flex gap-3">
            <div className="rounded-xl border border-line bg-brand-50 px-4 py-2.5 text-center">
              <div className="text-2xl font-extrabold tabular-nums text-brand-700">
                {totalDone}
                <span className="text-base font-bold text-muted">/100</span>
              </div>
              <div className="text-xs font-medium text-muted">已通过关键词</div>
            </div>
            <Link
              href="/redeem"
              className="rounded-xl border border-line bg-accent-100 px-4 py-2.5 text-center transition hover:brightness-[0.97]"
            >
              <div className="flex items-center justify-center gap-1 text-2xl font-extrabold tabular-nums text-accent-700">
                <span aria-hidden>🏅</span>
                {totalPoints}
              </div>
              <div className="text-xs font-medium text-accent-700">积分 · 去兑换</div>
            </Link>
          </div>
        )}
      </div>

      {/* 聚焦：本周任务 / 继续补做 */}
      {subject && focus && (
        <Link
          href={`/learn/chapter/${focus.ch.index}`}
          className="mt-7 block rounded-2xl bg-brand-600 p-6 text-white transition hover:-translate-y-0.5 hover:bg-brand-700 sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white/80">
                {focusIsWeek ? "本周任务" : "继续补做"} · 第 {focus.ch.index} 关
              </div>
              <h2 className="mt-1 text-2xl font-extrabold">{focus.ch.title}</h2>
              <p className="mt-1.5 line-clamp-1 text-sm text-white/85">{focus.ch.theme}</p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-extrabold tabular-nums">
              {focus.ch.index}
            </span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${focus.pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-white/90">
              {focus.done}/{focus.total}
            </span>
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand-700">
            {focus.done > 0 ? "继续闯关" : "开始闯关"} →
          </span>
        </Link>
      )}

      {/* 聚焦：已解锁关卡全通关 */}
      {subject && allUnlockedDone && (
        <div className="panel mt-7 flex flex-col items-center gap-4 rounded-2xl px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-lg font-bold text-ink">已解锁关卡全部完成</h2>
            <p className="mt-1 text-sm text-muted">
              {nextLockedIndex
                ? `下周一解锁第 ${nextLockedIndex} 关。可以先看排行榜或成长轨迹。`
                : "5 关都过了，去排行榜看看。"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/leaderboard" className="btn btn-secondary btn-sm">
              排行榜
            </Link>
            <Link href="/growth" className="btn btn-primary btn-sm">
              成长轨迹
            </Link>
          </div>
        </div>
      )}

      {subject ? (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted">闯关地图</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {states.map(({ ch, done, total, unlocked, fullyDone, pct }) => {
              const isWeek = ch.index === currentIndex;
              const inner = (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className={`map-node ${
                        fullyDone
                          ? "map-node-done"
                          : unlocked
                            ? "map-node-open"
                            : "map-node-locked"
                      }`}
                      aria-hidden
                    >
                      {fullyDone ? "✓" : unlocked ? ch.index : "🔒"}
                    </span>
                    <div className="flex-1">
                      <div className="font-bold text-ink">{ch.title}</div>
                      <div className="text-xs font-medium text-muted">
                        {unlocked ? `${done}/${total} 已通过` : `第 ${ch.index} 周开放`}
                      </div>
                    </div>
                    {fullyDone ? (
                      <span className="badge badge-success">已通关</span>
                    ) : isWeek && unlocked ? (
                      <span className="badge badge-brand">本周</span>
                    ) : null}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{ch.theme}</p>
                  {unlocked && (
                    <div className="mt-4 flex items-center gap-2">
                      <div className="progress flex-1">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-brand-700">
                        {pct}%
                      </span>
                    </div>
                  )}
                </>
              );
              return unlocked ? (
                <Link key={ch.id} href={`/learn/chapter/${ch.index}`} className="card-link p-5">
                  {inner}
                </Link>
              ) : (
                <div
                  key={ch.id}
                  className="card cursor-not-allowed bg-surface-2 p-5 opacity-80"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
            📚
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink">还没有开课</h2>
          <p className="mt-2 max-w-sm text-muted">
            管理员开启学科后，这里会显示你的闯关地图。
          </p>
        </div>
      )}
    </main>
  );
}
