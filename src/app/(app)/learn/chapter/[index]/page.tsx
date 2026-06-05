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
      <main className="animate-float-in page py-8">
        <Link href="/learn" className="text-sm font-medium text-muted transition hover:text-brand-700">
          ← 闯关地图
        </Link>
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
            🔒
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-ink">第 {chapter.index} 关尚未开放</h1>
          <p className="mt-2 max-w-sm text-muted">
            每周开放一关，第 {chapter.index} 周才解锁本关。先把已开放的关卡通关，攒积分、冲排名。
          </p>
          <Link href="/learn" className="btn btn-primary mt-6">
            回到闯关地图
          </Link>
        </div>
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

  const pct = Math.round((completed / chapter.keywords.length) * 100);
  // 下一个待通关的词（已完成的跳过）——驱动「继续闯关」与栅格里的高亮
  const nextKeyword = chapter.keywords.find((kw) => !byKeyword.get(kw.id)?.isCompleted) ?? null;

  return (
    <main className="animate-float-in page py-8">
      <Link href="/learn" className="text-sm font-medium text-muted transition hover:text-brand-700">
        ← 闯关地图
      </Link>

      {/* 关卡概览 + 继续闯关 */}
      <section className="card mt-3 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className={`map-node h-12 w-12 shrink-0 text-lg ${allDone ? "map-node-done" : "map-node-open"}`}
            aria-hidden
          >
            {allDone ? "✓" : chapter.index}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-brand-700">第 {chapter.index} 关</div>
            <h1 className="mt-0.5 text-2xl font-extrabold text-ink">{chapter.title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{chapter.theme}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="progress flex-1">
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
            {completed}/{chapter.keywords.length} · {pct}%
          </span>
        </div>

        {nextKeyword ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href={`/learn/keyword/${nextKeyword.id}`} className="btn btn-primary">
              {completed > 0 ? "继续闯关" : "开始闯关"} →
            </Link>
            <span className="text-sm text-muted">
              下一个：<span className="font-medium text-ink">{nextKeyword.term}</span>
            </span>
          </div>
        ) : (
          <div className="mt-5">
            <span className="badge badge-success">
              ✓ 本关 {chapter.keywords.length} 个关键词全部通关
            </span>
          </div>
        )}
      </section>

      {allDone && (
        <Link
          href={`/learn/chapter/${chapter.index}/reflect`}
          className="card-link mt-4 flex items-center justify-between gap-3 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="map-node map-node-done shrink-0" aria-hidden>
              🧩
            </span>
            <div>
              <div className="font-bold text-ink">本关已通关，来做章节反思</div>
              <div className="mt-0.5 text-xs text-muted">
                结合你的岗位，把本章所学落到实际工作中
              </div>
            </div>
          </div>
          <span className="btn btn-primary btn-sm shrink-0">
            {reflectionDone ? "查看反思" : "开始反思"}
          </span>
        </Link>
      )}

      <h2 className="mt-7 text-sm font-semibold text-muted">
        本关 {chapter.keywords.length} 个关键词
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chapter.keywords.map((kw, i) => {
          const p = byKeyword.get(kw.id);
          const status = p?.isCompleted ? "done" : p ? "doing" : "todo";
          const isNext = nextKeyword?.id === kw.id;
          return (
            <li key={kw.id}>
              <Link
                href={`/learn/keyword/${kw.id}`}
                className={`card-link flex items-center gap-3 p-4 ${
                  isNext ? "ring-2 ring-brand-300 ring-offset-2 ring-offset-bg" : ""
                }`}
              >
                <span
                  className={`map-node h-9 w-9 shrink-0 text-sm ${
                    status === "done"
                      ? "map-node-done"
                      : status === "doing"
                        ? "map-node-open"
                        : "map-node-locked"
                  }`}
                  aria-hidden
                >
                  {status === "done" ? "✓" : i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink">{kw.term}</span>
                {status === "done" ? (
                  <span className="badge badge-success shrink-0">{p!.bestFinalScore} 分</span>
                ) : status === "doing" ? (
                  <span className="badge badge-brand shrink-0">进行中</span>
                ) : isNext ? (
                  <span className="badge badge-brand shrink-0">下一个</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
