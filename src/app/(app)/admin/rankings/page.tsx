import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { getChapterRanking } from "@/lib/ranking";
import { SettleButton } from "./settle-button";

const medal = ["🥇", "🥈", "🥉"];

export default async function AdminRankingsPage() {
  await requireAdmin();
  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  if (!cfg?.activeSubjectId) redirect("/admin");

  const chapters = await prisma.chapter.findMany({
    where: { subjectId: cfg.activeSubjectId },
    orderBy: { index: "asc" },
  });

  const rankings = await Promise.all(
    chapters.map((ch) => getChapterRanking(cfg.activeSubjectId!, ch.id, ch.index)),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">章节排名结算</h1>
      <p className="mt-1 text-sm text-muted">
        仅完成该章全部关键词者入排名，按平均分排序，前 3 名各 +100 积分（并列均给）。可重复结算（不重复发奖）。
      </p>

      <div className="mt-6 space-y-5">
        {chapters.map((ch, i) => {
          const rows = rankings[i];
          return (
            <section key={ch.id} className="rounded-2xl border border-brand-100 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-ink">
                  第 {ch.index} 章 · {ch.title}
                </h2>
                <SettleButton chapterId={ch.id} />
              </div>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted">尚无结算结果（或还没有人完成全部关键词）。</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {rows.map((r) => (
                    <li
                      key={r.userId}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm odd:bg-brand-50/50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-center">
                          {r.rank <= 3 ? medal[r.rank - 1] : r.rank}
                        </span>
                        <span className="font-medium text-ink">{r.name}</span>
                      </span>
                      <span className="flex items-center gap-3 text-muted">
                        <span>均分 {r.avgScore.toFixed(1)}</span>
                        {r.bonusAwarded && (
                          <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs font-bold text-accent-500">
                            +100
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
