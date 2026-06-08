import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserOnboarded } from "@/lib/auth/user";
import {
  getChapterWinners,
  getLeaderboard,
  getMyPointsRank,
  getPointsLeaderboard,
} from "@/lib/social";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";

const medal = ["🥇", "🥈", "🥉"];

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}

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

  const [leaders, winners, pointsBoard, myPoints] = await Promise.all([
    getLeaderboard(subject.id),
    getChapterWinners(subject.id),
    getPointsLeaderboard(),
    getMyPointsRank(user.id),
  ]);

  const myRow = leaders.find((r) => r.userId === user.id);
  const myRank = myRow ? leaders.findIndex((r) => r.userId === user.id) + 1 : null;

  return (
    <main className="page py-8">
      <div className="animate-float-in">
        <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">排行榜</h1>
        <p className="mt-1.5 text-muted">看谁攒的积分多、谁的笔记写得好。</p>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div>
            <h2 className="font-bold text-ink">积分总榜</h2>
            <p className="mt-0.5 text-xs text-muted">全平台 · 跨学科 · 累计获得，已兑换不掉榜</p>
          </div>
          {myPoints.rank ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="badge badge-gold">我</span>
              <span className="font-bold tabular-nums text-ink">第 {myPoints.rank} 名</span>
              <span className="text-muted">
                累计 <span className="font-semibold text-accent-700">{myPoints.earned}</span> 分
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted">你还没有积分 · 通关 / 拿排名即上榜</span>
          )}
        </div>
        {pointsBoard.length === 0 ? (
          <div className="card px-6 py-8 text-center text-sm text-muted">
            还没有人获得积分。通关关键词、拿章节排名后这里就有了。
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {pointsBoard.map((r, i) => {
              const rank = i + 1;
              const isTop3 = rank <= 3;
              const isMe = r.userId === user.id;
              return (
                <li
                  key={r.userId}
                  className={`flex items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:px-4 ${
                    isMe ? "bg-brand-50" : rank === 1 ? "bg-accent-100/45" : ""
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
                    <span className="hidden text-muted sm:inline">
                      通关 {r.base}
                      {r.bonus > 0 && ` · 排名奖 ${r.bonus}`}
                    </span>
                    <span className="font-bold tabular-nums text-accent-700">{r.earned} 分</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 学习榜（按学科）：标题与「我的名次」在 tab 之上，tab 紧贴下面的榜单 */}
      <div className="mt-9 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="font-bold text-ink">学习榜</h2>
          <p className="mt-0.5 text-xs text-muted">
            {subject.title} · 按每词最高分均分排名，点开看 ta 的闯关记录
          </p>
        </div>
        {myRow ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge badge-brand">我</span>
            <span className="font-bold tabular-nums text-ink">第 {myRank} 名</span>
            <span className="text-muted">
              均分 <span className="font-semibold text-accent-700">{myRow.avgScore.toFixed(2)}</span>
            </span>
            <Link
              href="/growth"
              className="text-xs font-medium text-brand-700 transition hover:text-brand-600"
            >
              成长轨迹 →
            </Link>
          </div>
        ) : (
          <span className="text-sm text-muted">你还没上榜 · 通关一个词就入榜</span>
        )}
      </div>
      <SubjectTabs subjects={subjects} activeId={subject.id} basePath="/leaderboard" />

      <section>
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
                      <span className="hidden tabular-nums text-muted md:inline">
                        {formatMinutes(r.learningMinutes)}
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
