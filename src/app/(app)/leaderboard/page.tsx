import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { getChapterWinners, getLeaderboard } from "@/lib/social";

const medal = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const user = await requireUser();
  if (user.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) redirect("/onboarding");
  }

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    include: { activeSubject: { select: { title: true } } },
  });
  if (!cfg?.activeSubjectId) redirect("/learn");

  const [leaders, winners] = await Promise.all([
    getLeaderboard(cfg.activeSubjectId),
    getChapterWinners(cfg.activeSubjectId),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-ink">排行榜</h1>
      <p className="mt-1 text-sm text-muted">学科：{cfg.activeSubject?.title} · 一起学、互相比</p>

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">🏅 积分榜</h2>
        {leaders.length === 0 ? (
          <p className="text-sm text-muted">还没有人上榜，快去闯关赚积分！</p>
        ) : (
          <ul className="space-y-1">
            {leaders.map((r, i) => (
              <li
                key={r.userId}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                  i < 3 ? "bg-gradient-to-r from-brand-50 to-white" : "odd:bg-brand-50/40"
                } ${r.userId === user.id ? "ring-2 ring-brand-300" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold">
                    {i < 3 ? medal[i] : i + 1}
                  </span>
                  <span className="font-medium text-ink">{r.name}</span>
                  {r.userId === user.id && <span className="text-xs text-brand-700">（你）</span>}
                </span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  <span>{r.completed} 词</span>
                  <span className="font-bold text-accent-500">{r.points} 分</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-bold text-ink">🏆 各章冠军</h2>
        {winners.length === 0 ? (
          <p className="text-sm text-muted">还没有章节完成结算。</p>
        ) : (
          <div className="space-y-3">
            {winners.map((w) => (
              <div key={w.chapterIndex} className="rounded-xl border border-brand-100 bg-white/80 p-4">
                <div className="text-sm font-bold text-ink">
                  第 {w.chapterIndex} 章 · {w.chapterTitle}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {w.winners.map((win, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                    >
                      {win.rank <= 3 ? medal[win.rank - 1] : `${win.rank}`} {win.name}
                      <span className="text-muted">· {win.avgScore.toFixed(0)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
