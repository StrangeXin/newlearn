import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { isChapterUnlocked } from "@/lib/schedule";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = await params;
  const chapterIndex = Number.parseInt(index, 10);
  const user = await requireUser();

  if (user.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) redirect("/onboarding");
  }

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  if (!cfg?.activeSubjectId) redirect("/learn");

  const chapter = await prisma.chapter.findFirst({
    where: { subjectId: cfg.activeSubjectId, index: chapterIndex },
    include: {
      keywords: { orderBy: { orderIndex: "asc" } },
      subject: { select: { startDate: true } },
    },
  });
  if (!chapter) notFound();

  if (!isChapterUnlocked(chapter.subject, chapter.index)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Link href="/learn" className="text-sm text-muted hover:text-brand-700">
          ← 闯关地图
        </Link>
        <div className="mt-10 text-5xl">🔒</div>
        <h1 className="mt-4 text-2xl font-extrabold text-ink">第 {chapter.index} 关尚未开放</h1>
        <p className="mt-2 text-muted">每周开放一关，第 {chapter.index} 周才解锁本关，先把已开放的关卡通关吧。</p>
      </main>
    );
  }

  const progresses = await prisma.keywordProgress.findMany({
    where: { userId: user.id, keywordId: { in: chapter.keywords.map((k) => k.id) } },
  });
  const byKeyword = new Map(progresses.map((p) => [p.keywordId, p]));
  const completed = progresses.filter((p) => p.isCompleted).length;
  const allDone = completed === chapter.keywords.length && chapter.keywords.length > 0;
  const reflection = allDone
    ? await prisma.chapterReflection.findUnique({
        where: { userId_chapterId: { userId: user.id, chapterId: chapter.id } },
        select: { summary: true },
      })
    : null;
  const reflectionDone = !!reflection?.summary;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/learn" className="text-sm text-muted transition hover:text-brand-700">
        ← 闯关地图
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            第 {chapter.index} 关 · {chapter.title}
          </h1>
          <p className="mt-1 text-sm text-muted">{chapter.theme}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-extrabold text-brand-700">
            {completed}/{chapter.keywords.length}
          </div>
          <div className="text-xs text-muted">已通过</div>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
          style={{ width: `${(completed / chapter.keywords.length) * 100}%` }}
        />
      </div>

      {allDone && (
        <Link
          href={`/learn/chapter/${chapter.index}/reflect`}
          className="mt-5 flex items-center justify-between rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-accent-400/10 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <div className="font-bold text-ink">🎉 已通关本章！来做章节反思</div>
            <div className="text-xs text-muted">
              结合你的岗位，把本章所学落到实际工作中
            </div>
          </div>
          <span className="rounded-full bg-brand-600 px-3 py-1 text-sm font-semibold text-white">
            {reflectionDone ? "查看反思" : "开始反思"}
          </span>
        </Link>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {chapter.keywords.map((kw, i) => {
          const p = byKeyword.get(kw.id);
          const status = p?.isCompleted ? "done" : p ? "doing" : "todo";
          return (
            <li key={kw.id}>
              <Link
                href={`/learn/keyword/${kw.id}`}
                className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    status === "done"
                      ? "bg-success-500/15 text-success-500"
                      : status === "doing"
                        ? "bg-accent-500/15 text-accent-500"
                        : "bg-brand-100 text-brand-700"
                  }`}
                >
                  {status === "done" ? "✓" : i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{kw.term}</span>
                {p && (
                  <span className="shrink-0 text-xs text-muted">
                    {status === "done" ? `${p.bestFinalScore} 分` : `进行中 ${p.bestFinalScore}`}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
