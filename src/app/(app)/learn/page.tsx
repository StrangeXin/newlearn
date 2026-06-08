import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserOnboarded } from "@/lib/auth/user";
import { getScheduleInfo, isCycleEnded } from "@/lib/schedule";
import { ACTIVE_SUBJECT_WHERE, sortSubjectsForLearners, SUBJECT_ORDER } from "@/lib/subject";
import { UiIllustration } from "@/components/ui-illustration";

function getSubjectGuide(title: string) {
  if (title.includes("普及版")) {
    return {
      badge: "推荐先学",
      badgeClass: "badge-brand",
      audience: "适合所有员工 · 零基础入门",
      hint: "先建立 AI 基础地图，再去看专业内容更稳。",
      cta: "进入普及版",
      cardClass: "ring-2 ring-brand-200",
    };
  }
  if (title.includes("专业版")) {
    return {
      badge: "进阶挑战",
      badgeClass: "badge-muted",
      audience: "适合技术 / 产品 / 数据岗位 · 已有一定基础",
      hint: "默认你已经了解 AI 基础概念，会更偏原理与落地判断。",
      cta: "进入专业版",
      cardClass: "",
    };
  }
  return {
    badge: "学习主题",
    badgeClass: "badge-muted",
    audience: "按当前学习计划开放",
    hint: "进入后按章节顺序完成关键词闯关。",
    cta: "进入学科",
    cardClass: "",
  };
}

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
  const sortedSubjects = sortSubjectsForLearners(subjects);

  if (sortedSubjects.length === 0) {
    return (
      <main className="page py-8">
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <UiIllustration
            name="learn"
            alt="等待选择学科开始闯关的手绘插画"
            className="aspect-[4/3] w-full max-w-xs"
          />
          <h1 className="mt-5 text-xl font-bold text-ink">还没有开课</h1>
          <p className="mt-2 max-w-sm text-muted">管理员开启学科后，这里会列出可学习的主题。</p>
        </div>
      </main>
    );
  }

  // 仅一个学科：直接进入，省去一次点击
  if (sortedSubjects.length === 1) {
    redirect(`/learn/${sortedSubjects[0].id}`);
  }

  const ids = sortedSubjects.map((s) => s.id);
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
      <div className="animate-float-in grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_220px] sm:items-center sm:p-6">
        <div>
          <p className="text-sm text-muted">欢迎回来</p>
          <h1 className="mt-0.5 text-3xl font-extrabold text-ink">{user.name}</h1>
          <p className="mt-2 text-muted">
            当前有 <span className="font-semibold text-brand-700">{sortedSubjects.length}</span> 个学习主题，挑一个开始闯关。
          </p>
        </div>
        <UiIllustration
          name="learn"
          alt="选择学科开始闯关的手绘插画"
          className="aspect-[4/3] w-full"
        />
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {sortedSubjects.map((s) => {
          const total = s.chapters.reduce((sum, c) => sum + c._count.keywords, 0);
          const done = doneMap.get(s.id) ?? 0;
          const pts = ptMap.get(s.id) ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const schedule = getScheduleInfo(s);
          const ended = isCycleEnded(s, s.chapters.length);
          const guide = getSubjectGuide(s.title);
          return (
            <Link
              key={s.id}
              href={`/learn/${s.id}`}
              className={`card-link flex flex-col p-6 transition hover:-translate-y-0.5 ${guide.cardClass}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-extrabold text-ink">{s.title}</h2>
                    <span className={`badge ${guide.badgeClass}`}>{guide.badge}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{guide.audience}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{guide.hint}</p>
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
                {done > 0 ? guide.cta.replace("进入", "继续") : guide.cta} →
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
