import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserOnboarded } from "@/lib/auth/user";
import { getScheduleInfo, isChapterUnlocked, isCycleEnded } from "@/lib/schedule";
import { getActiveSubjectById } from "@/lib/subject";
import { UiIllustration } from "@/components/ui-illustration";

// 单个学科的闯关地图。subjectId 来自路由，校验为「已上线」学科。
export default async function SubjectMapPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const user = await requireUserOnboarded();

  // 校验学科存在且已上线；同时取其章节
  const subjectBase = await getActiveSubjectById(subjectId);
  if (!subjectBase) redirect("/learn");
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      chapters: {
        orderBy: { index: "asc" },
        include: { _count: { select: { keywords: true } } },
      },
    },
  });
  if (!subject) redirect("/learn");

  // 是否存在其它已上线学科（决定是否显示「切换学科」入口）
  const activeCount = await prisma.subject.count({
    where: { isActive: true, archivedAt: null },
  });

  // 个人进度：各章已通过数 + 积分（按本学科）
  const [completedByChapter, points] = await Promise.all([
    prisma.keywordProgress.groupBy({
      by: ["chapterId"],
      where: { userId: user.id, subjectId: subject.id, isCompleted: true },
      _count: { _all: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { userId: user.id, subjectId: subject.id },
      _sum: { amount: true },
    }),
  ]);
  const doneMap = new Map(completedByChapter.map((c) => [c.chapterId, c._count._all]));
  const totalDone = completedByChapter.reduce((s, c) => s + c._count._all, 0);
  const totalKeywords = subject.chapters.reduce((s, c) => s + c._count.keywords, 0);
  // 全学科 100 词通关 → 可领结业证书
  const allDone = totalKeywords > 0 && totalDone >= totalKeywords;
  const totalPoints = points._sum.amount ?? 0;
  const portraitUpdates =
    (await prisma.employeeMemory.findUnique({
      where: { userId: user.id },
      select: { updateCount: true },
    }))?.updateCount ?? 0;
  const schedule = getScheduleInfo(subject);
  const chapters = subject.chapters;
  // 周期是否已结束：此后是「补学」模式——照常拿基础分，但不再参与章节排名
  const ended = isCycleEnded(subject, chapters.length);

  // 章节状态 + 聚焦（本周任务 / 补做 / 全通关）
  const states = chapters.map((ch) => {
    const done = doneMap.get(ch.id) ?? 0;
    const total = ch._count.keywords;
    const unlocked = isChapterUnlocked(subject, ch.index);
    return {
      ch,
      done,
      total,
      unlocked,
      fullyDone: unlocked && total > 0 && done >= total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });
  // 周期结束后不再有「本周」概念（所有章节都进入补学）
  const currentIndex =
    schedule.started && !ended ? Math.min(schedule.currentWeek, chapters.length) : 0;
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
      {activeCount > 1 && (
        <Link
          href="/learn"
          className="animate-float-in text-sm font-medium text-muted transition hover:text-brand-700"
        >
          ← 切换学科
        </Link>
      )}
      <div className="animate-float-in mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">欢迎回来</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-ink">{user.name}</h1>
          <p className="mt-2 text-muted">
            当前学科 <span className="font-semibold text-brand-700">{subject.title}</span>
            {ended ? (
              <>
                {" · "}
                <span className="font-semibold text-brand-700">培训周期已结束</span>
                ，补学不限时（照常拿基础积分，不再参与章节排名）
              </>
            ) : (
              schedule.started && (
                <>
                  {" · "}已开课第{" "}
                  <span className="font-semibold text-brand-700">{schedule.currentWeek}</span> 周，
                  本周开放到第 {Math.min(schedule.currentWeek, chapters.length)} 关
                </>
              )
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-line bg-brand-50 px-4 py-2.5 text-center">
            <div className="text-2xl font-extrabold tabular-nums text-brand-700">
              {totalDone}
              <span className="text-base font-bold text-muted">/{totalKeywords}</span>
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
          {portraitUpdates > 0 && (
            <Link
              href="/growth"
              className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-center transition hover:brightness-[0.97]"
            >
              <div className="flex items-center justify-center gap-1 text-2xl font-extrabold tabular-nums text-brand-700">
                <span aria-hidden>📈</span>
                {portraitUpdates}
              </div>
              <div className="text-xs font-medium text-muted">画像更新 · 看轨迹</div>
            </Link>
          )}
        </div>
      </div>

      {/* 聚焦：本周任务 / 继续补做 */}
      {focus && (
        <Link
          href={`/learn/${subject.id}/chapter/${focus.ch.index}`}
          className="mt-7 grid gap-5 rounded-2xl bg-brand-600 p-6 text-white transition hover:-translate-y-0.5 hover:bg-brand-700 sm:p-7 lg:grid-cols-[1fr_260px] lg:items-center"
        >
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/80">
                  {ended ? "继续补学" : focusIsWeek ? "本周任务" : "继续补做"} · 第 {focus.ch.index} 关
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
          </div>
          <UiIllustration
            name="subject"
            alt="本周任务闯关地图手绘插画"
            className="aspect-[4/3] border-white/30"
            imageClassName="p-2"
          />
        </Link>
      )}

      {/* 全学科通关：领结业证书 */}
      {allDone && (
        <Link
          href={`/learn/${subject.id}/certificate`}
          className="mt-7 block rounded-2xl border border-accent-200 bg-accent-100 p-6 transition hover:-translate-y-0.5 hover:brightness-[0.98] sm:p-7"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl"
                aria-hidden
              >
                🎓
              </span>
              <div>
                <div className="text-sm font-medium text-accent-700">
                  全部 {totalKeywords} 个关键词已通关
                </div>
                <h2 className="mt-0.5 text-2xl font-extrabold text-ink">你已结业</h2>
                <p className="mt-1 text-sm text-accent-700">查看结业证书，可下载为图片</p>
              </div>
            </div>
            <span className="btn btn-primary shrink-0">查看证书 →</span>
          </div>
        </Link>
      )}

      {/* 聚焦：已解锁关卡全通关（未全部 100 词通关时） */}
      {allUnlockedDone && !allDone && (
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
            <Link
              key={ch.id}
              href={`/learn/${subject.id}/chapter/${ch.index}`}
              className="card-link p-5"
            >
              {inner}
            </Link>
          ) : (
            <div key={ch.id} className="card cursor-not-allowed bg-surface-2 p-5 opacity-80">
              {inner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
