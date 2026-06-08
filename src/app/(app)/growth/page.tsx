import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth/user";
import { parseTags } from "@/lib/memory-diff";
import { GrowthTimeline, PortraitCard } from "@/components/growth-timeline";

const dateFmt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });

function averageScore(snapshots: { finalScore: number }[]) {
  if (snapshots.length === 0) return 0;
  const avg = snapshots.reduce((sum, s) => sum + s.finalScore, 0) / snapshots.length;
  return Math.round(avg * 10) / 10;
}

export default async function GrowthPage() {
  const { user } = await requireProfile();

  const [memory, snapshots] = await Promise.all([
    prisma.employeeMemory.findUnique({ where: { userId: user.id } }),
    prisma.employeeMemorySnapshot.findMany({
      where: { userId: user.id },
      orderBy: { seq: "asc" },
    }),
  ]);

  const tags = parseTags(memory?.tags);
  const latest = snapshots.at(-1);
  const avgScore = averageScore(snapshots);

  return (
    <main className="page py-8">
      <div className="animate-float-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">成长轨迹</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            系统会根据你的关键词作答与章节反思持续更新画像，记录强项、薄弱点和兴趣方向。
          </p>
        </div>
        <Link href="/profile" className="btn btn-secondary btn-sm">
          查看我的资料
        </Link>
      </div>

      {snapshots.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-open mb-4 h-14 w-14 text-2xl" aria-hidden>
            1
          </span>
          <h2 className="text-xl font-bold text-ink">还没有画像</h2>
          <p className="mt-2 max-w-sm leading-relaxed text-muted">
            通过第一个关键词后会落下一笔记录；从第二个词起，每条记录会标出这次多了哪些标签。
          </p>
          <Link href="/learn" className="btn btn-primary mt-6">
            去闯关 →
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-4">
              <div className="text-xs font-medium text-brand-700">画像更新</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums text-brand-700">
                {memory?.updateCount ?? 0}
              </div>
              <div className="text-xs text-muted">累计更新次数</div>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-4">
              <div className="text-xs font-medium text-muted">最近一次</div>
              <div className="mt-1 truncate text-lg font-bold text-ink">
                {latest ? latest.keywordTerm : "暂无"}
              </div>
              <div className="text-xs text-muted">
                {latest ? dateFmt.format(latest.createdAt) : "继续学习后生成"}
              </div>
            </div>
            <div className="rounded-xl border border-accent-400/60 bg-accent-100 px-4 py-4">
              <div className="text-xs font-medium text-accent-700">平均终评分</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums text-accent-700">
                {avgScore}
              </div>
              <div className="text-xs text-muted">基于 {snapshots.length} 次画像记录</div>
            </div>
          </section>

          <section className="mt-6">
            <PortraitCard tags={tags} portrait={memory?.portrait ?? ""} />
          </section>

          <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">画像变更</h2>
              <p className="mt-1 text-sm text-muted">按时间倒序展示，每条可查看画像正文改动。</p>
            </div>
            <span className="badge badge-muted">共 {snapshots.length} 次</span>
          </div>
          <div className="mt-4">
            <GrowthTimeline snapshots={snapshots} />
          </div>
        </>
      )}
    </main>
  );
}
