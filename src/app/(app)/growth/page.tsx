import Link from "next/link";
import { Eye } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth/user";
import { type DiffLine, lineDiff, parseDiff, parseTags } from "@/lib/memory-diff";
import { ExpandableText } from "@/components/expandable-text";

function scoreBadge(score: number) {
  // 金色只用于通过/高分（奖励语义）；未达标用中性，避免金色误用
  const badge = score >= 85 ? "badge-gold" : score >= 60 ? "badge-success" : "badge-muted";
  return <span className={`badge ${badge}`}>{score} 分</span>;
}

function PortraitChips({ items, badge }: { items: string[]; badge: string }) {
  if (items.length === 0)
    return <span className="text-sm text-muted">尚未识别，多答几个词就有了</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`badge ${badge}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function AddChips({ label, items, badge }: { label: string; items: string[]; badge: string }) {
  if (items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      {items.map((t) => (
        <span key={t} className={`badge ${badge}`}>
          +{t}
        </span>
      ))}
    </span>
  );
}

function GitDiff({ lines }: { lines: DiffLine[] }) {
  // 只展示有变化的行及其紧邻上下文，保持卡片紧凑
  const keep = lines.map((l, i) => {
    const near =
      l.type !== "ctx" ||
      lines[i - 1]?.type !== "ctx" ||
      lines[i + 1]?.type !== "ctx";
    return near ? l : null;
  });
  return (
    <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">
      {keep.map((l, i) =>
        l === null ? (
          i > 0 && keep[i - 1] !== null ? (
            <div key={i} className="select-none text-muted">
              ⋯
            </div>
          ) : null
        ) : (
          <div
            key={i}
            className={
              l.type === "add"
                ? "bg-success-500/10 text-success-600"
                : l.type === "del"
                  ? "bg-danger-500/10 text-danger-600"
                  : "text-muted"
            }
          >
            <span className="select-none opacity-70">
              {l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}
            </span>
            {l.text || " "}
          </div>
        ),
      )}
    </pre>
  );
}

const dateFmt = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
});

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
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];
  const latest = snapshots.at(-1);
  const avgScore = averageScore(snapshots);
  const changedCount = snapshots.filter((s) => {
    const d = parseDiff(s.diff);
    return d.portraitChanged;
  }).length;

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
              <div className="text-xs text-muted">{latest ? dateFmt.format(latest.createdAt) : "继续学习后生成"}</div>
            </div>
            <div className="rounded-xl border border-accent-400/60 bg-accent-100 px-4 py-4">
              <div className="text-xs font-medium text-accent-700">平均终评分</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums text-accent-700">
                {avgScore}
              </div>
              <div className="text-xs text-muted">基于 {snapshots.length} 次画像记录</div>
            </div>
          </section>

          {/* 当前画像概览：标签 chips + 完整摘要可展开 */}
          <section className="mt-6 space-y-6">
            <div className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">当前画像</h2>
                <span className="badge badge-brand">{changedCount} 次正文变化</span>
              </div>
              <div className="mt-5 space-y-5">
                <div>
                  <div className="field-label">掌握强项</div>
                  <PortraitChips items={tags.strengths} badge="badge-success" />
                </div>
                <div>
                  <div className="field-label">待加强 / 盲区</div>
                  <PortraitChips items={weaknesses} badge="badge-muted" />
                </div>
                <div>
                  <div className="field-label">兴趣方向</div>
                  <PortraitChips items={tags.interests} badge="badge-brand" />
                </div>
              </div>
            </div>

            <div className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">画像全文</h2>
                <span className="text-xs font-medium text-muted">持续随作答更新</span>
              </div>
              <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
                <ExpandableText markdown text={memory?.portrait || "画像正文会随你作答逐步补全。"} />
              </div>
            </div>
          </section>

          {/* 时间线：每次更新的 git 风格 diff */}
          <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">画像变更</h2>
              <p className="mt-1 text-sm text-muted">按时间倒序展示，每条可查看画像正文改动。</p>
            </div>
            <span className="badge badge-muted">共 {snapshots.length} 次</span>
          </div>
          <ol className="relative mt-4 border-l-2 border-line pl-5 sm:pl-6">
            {[...snapshots].reverse().map((s, i) => {
              const d = parseDiff(s.diff);
              const diffLines = lineDiff(d.prevPortrait, d.newPortrait);
              const noTagChange =
                d.addedStrengths.length +
                  d.addedWeaknesses.length +
                  d.addedBlindSpots.length +
                  d.addedInterests.length ===
                0;
              const hasAdds = !noTagChange;
              return (
                <li key={s.id} className="mb-5 last:mb-0">
                  <span className="absolute -left-[9px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-bg" />
                  <div className="card p-4 transition hover:border-brand-200 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">第 {s.seq} 次更新</span>
                          {scoreBadge(s.finalScore)}
                        </div>
                        <div className="mt-1 truncate text-sm text-muted">
                          答完「<span className="font-medium text-ink">{s.keywordTerm}</span>」
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {dateFmt.format(s.createdAt)}
                      </span>
                    </div>

                    {hasAdds ? (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        <AddChips label="新增强项" items={d.addedStrengths} badge="badge-success" />
                        <AddChips label="新增待加强" items={d.addedWeaknesses} badge="badge-muted" />
                        <AddChips label="新增盲区" items={d.addedBlindSpots} badge="badge-muted" />
                        <AddChips label="新增兴趣" items={d.addedInterests} badge="badge-brand" />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted">
                        {d.portraitChanged ? "标签未变，画像措辞有微调" : "本次没有明显变化"}
                      </p>
                    )}

                    {(d.portraitChanged || hasAdds) && (
                      <details open={i === 0} className="details-chevron mt-3">
                        <summary className="flex cursor-pointer list-none justify-end">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
                            title="看画像改了哪几行"
                            aria-label="看画像改了哪几行"
                          >
                            <Eye className="size-4" aria-hidden />
                          </span>
                        </summary>
                        <GitDiff lines={diffLines} />
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
