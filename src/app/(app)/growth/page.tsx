import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { type DiffLine, lineDiff, parseDiff, parseTags } from "@/lib/memory-diff";

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

export default async function GrowthPage() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/admin");

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const [memory, snapshots] = await Promise.all([
    prisma.employeeMemory.findUnique({ where: { userId: user.id } }),
    prisma.employeeMemorySnapshot.findMany({
      where: { userId: user.id },
      orderBy: { seq: "asc" },
    }),
  ]);

  const tags = parseTags(memory?.tags);
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];

  return (
    <main className="page-narrow py-8">
      <div className="animate-float-in">
        <h1 className="text-2xl font-bold text-ink">成长轨迹</h1>
        <p className="mt-1.5 max-w-prose leading-relaxed text-muted">
          每通过一个关键词，AI 都会重写一次它对你的画像。这里按时间倒推每一次更新，
          看得到它从哪句话开始懂你、又是怎么一步步变准的。
        </p>
      </div>

      {snapshots.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-open mb-4 h-14 w-14 text-2xl" aria-hidden>
            1
          </span>
          <h2 className="text-xl font-bold text-ink">第一张画像还没写出来</h2>
          <p className="mt-2 max-w-sm leading-relaxed text-muted">
            提交并通过第一个关键词后，AI 会落下对你的第一笔画像；从第二个词起，
            这里每条记录都会标出「这次它多懂了你什么」。
          </p>
          <Link href="/learn" className="btn btn-primary mt-6">
            去闯关 →
          </Link>
        </div>
      ) : (
        <>
          {/* 当前画像概览：标签 chips + 完整摘要可展开 */}
          <section className="card mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">此刻的你（AI 视角）</h2>
              <span className="badge badge-brand">已更新 {memory?.updateCount ?? 0} 次</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
            <details className="mt-5 rounded-xl border border-line bg-surface-2">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-brand-700">
                展开 AI 写的完整画像
              </summary>
              <pre className="whitespace-pre-wrap border-t border-line px-3 py-3 font-mono text-xs leading-relaxed text-ink">
                {memory?.portrait || "画像正文会随你作答逐步补全。"}
              </pre>
            </details>
          </section>

          {/* 时间线：每次更新的 git 风格 diff */}
          <h2 className="mt-9 text-sm font-semibold text-muted">
            画像演进 · 共 {snapshots.length} 次
          </h2>
          <ol className="relative mt-4 border-l-2 border-line pl-6">
            {[...snapshots].reverse().map((s) => {
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
                <li key={s.id} className="mb-6">
                  <span className="absolute -left-[9px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-bg" />
                  <div className="card p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-ink">
                        第 {s.seq} 次更新
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-sm text-ink">
                        答完「{s.keywordTerm}」
                      </span>
                      {scoreBadge(s.finalScore)}
                      <span className="ml-auto text-xs text-muted">
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
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                          逐行看画像改了哪里
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
