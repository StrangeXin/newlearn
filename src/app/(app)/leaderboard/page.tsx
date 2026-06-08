import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserOnboarded } from "@/lib/auth/user";
import { getChapterWinners, getLeaderboard } from "@/lib/social";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";

const medal = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const user = await requireUserOnboarded();

  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/learn");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];

  const [leaders, winners] = await Promise.all([
    getLeaderboard(subject.id),
    getChapterWinners(subject.id),
  ]);

  const myRow = leaders.find((r) => r.userId === user.id);
  const myRank = myRow ? leaders.findIndex((r) => r.userId === user.id) + 1 : null;

  return (
    <main className="page py-8">
      <SubjectTabs subjects={subjects} activeId={subject.id} basePath="/leaderboard" />
      <div className="animate-float-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">排行榜</h1>
          <p className="mt-1.5 text-muted">
            {subject.title} · 按每个词最高分的平均分排名，写得越好排得越前。
          </p>
        </div>
        {myRow ? (
          <div className="flex flex-col items-end gap-1.5">
            <div className="rounded-xl border border-line bg-brand-50 px-4 py-2.5 text-center">
              <div className="text-2xl font-extrabold tabular-nums text-brand-700">
                第 {myRank} 名
              </div>
              <div className="text-xs font-medium text-muted">
                均分 <span className="text-accent-700">{myRow.avgScore.toFixed(2)}</span> ·{" "}
                {myRow.completed} 词
              </div>
            </div>
            <Link
              href="/growth"
              className="text-xs font-medium text-brand-700 transition hover:text-brand-600"
            >
              看我的成长轨迹 →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface px-4 py-2.5 text-center">
            <div className="text-sm font-bold text-ink">你还没上榜</div>
            <div className="text-xs text-muted">通关一个词就入榜</div>
          </div>
        )}
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-ink">学习榜</h2>
          <span className="text-xs text-muted">点开看 ta 的闯关记录</span>
        </div>
        {leaders.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
              🏁
            </span>
            <h3 className="mt-5 text-lg font-bold text-ink">还没有人上榜</h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              通关一个关键词就能上榜，按每词最高分的均分排名。
            </p>
            <Link href="/learn" className="btn btn-primary mt-6">
              去闯关 →
            </Link>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {leaders.map((r, i) => {
              const rank = i + 1;
              const isFirst = rank === 1;
              const isTop3 = rank <= 3;
              const isMe = r.userId === user.id;
              return (
                <li key={r.userId} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/leaderboard/${r.userId}?subject=${subject.id}`}
                    className={`flex items-center justify-between gap-3 px-3 py-3 transition hover:bg-surface-2 sm:px-4 ${
                      isMe ? "bg-brand-50" : isFirst ? "bg-accent-100/45" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center text-center text-sm font-bold tabular-nums ${
                          isTop3
                            ? "rounded-full bg-accent-100 text-base text-accent-700"
                            : "text-muted"
                        }`}
                        aria-hidden={isTop3}
                      >
                        {isTop3 ? medal[i] : rank}
                      </span>
                      <span className="truncate font-semibold text-ink">{r.name}</span>
                      {isMe && <span className="badge badge-brand shrink-0">你</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="hidden tabular-nums text-muted sm:inline">
                        {r.completed} 词
                      </span>
                      <span className="font-bold tabular-nums text-accent-700">
                        均 {r.avgScore.toFixed(2)}
                      </span>
                      <span className="text-muted" aria-hidden>
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-ink">各章冠军</h2>
          <span className="text-xs text-muted">每周日夜结算 · 完成全部 20 词且做完章节反思才入选</span>
        </div>
        {winners.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
              🏆
            </span>
            <h3 className="mt-5 text-lg font-bold text-ink">还没有章节结算</h3>
            <p className="mt-2 max-w-md text-sm text-muted">
              每周日结算当周前 3 名，各奖 100 积分。
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {winners.map((w) => (
              <div key={w.chapterIndex} className="card p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span className="badge badge-brand shrink-0">第 {w.chapterIndex} 章</span>
                  <span className="truncate">{w.chapterTitle}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {w.winners.map((win, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-base" aria-hidden>
                          {medal[win.rank - 1] ?? win.rank}
                        </span>
                        <span className="truncate font-medium text-ink">{win.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-accent-700">
                        均 {win.avgScore.toFixed(2)} 分
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
