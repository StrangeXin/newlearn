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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="animate-float-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">欢迎回来，</p>
          <h1 className="text-3xl font-extrabold text-ink">{user.name} 👋</h1>
          {subject ? (
            <p className="mt-2 text-muted">
              当前学科：
              <span className="font-semibold text-brand-700">{subject.title}</span>
            </p>
          ) : (
            <p className="mt-2 text-muted">管理员还没有开启任何学科，请稍候。</p>
          )}
        </div>
        {subject && (
          <div className="flex gap-3">
            <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold text-brand-700">{totalDone}/100</div>
              <div className="text-xs text-muted">已通过</div>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-2 text-center">
              <div className="text-2xl font-extrabold text-accent-500">{totalPoints}</div>
              <div className="text-xs text-muted">积分</div>
            </div>
          </div>
        )}
      </div>

      {subject && schedule.started && (
        <p className="mt-4 text-sm text-muted">
          已开课第 <span className="font-semibold text-brand-700">{schedule.currentWeek}</span> 周 ·
          本周开放到第 {Math.min(schedule.currentWeek, subject.chapters.length)} 关
        </p>
      )}

      {subject && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subject.chapters.map((ch) => {
            const done = doneMap.get(ch.id) ?? 0;
            const unlocked = isChapterUnlocked(subject, ch.index);
            const inner = (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                      unlocked
                        ? "bg-gradient-to-br from-brand-500 to-brand-700"
                        : "bg-muted/40"
                    }`}
                  >
                    {unlocked ? ch.index : "🔒"}
                  </span>
                  <div className="flex-1">
                    <div className="font-bold text-ink">{ch.title}</div>
                    <div className="text-xs text-muted">
                      {unlocked ? `${done}/${ch._count.keywords} 已通过` : `第 ${ch.index} 周开放`}
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{ch.theme}</p>
                {unlocked && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      style={{ width: `${(done / ch._count.keywords) * 100}%` }}
                    />
                  </div>
                )}
              </>
            );
            return unlocked ? (
              <Link
                key={ch.id}
                href={`/learn/chapter/${ch.index}`}
                className="group rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={ch.id}
                className="cursor-not-allowed rounded-2xl border border-dashed border-brand-200 bg-white/40 p-5 opacity-70"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
