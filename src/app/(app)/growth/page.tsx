import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { type DiffLine, lineDiff, parseDiff } from "@/lib/memory-diff";

function scoreBadge(score: number) {
  const cls =
    score >= 85
      ? "bg-success-500/15 text-success-500"
      : score >= 60
        ? "bg-brand-100 text-brand-700"
        : "bg-accent-500/15 text-accent-500";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{score} 分</span>;
}

function AddChips({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-xs text-muted">{label}</span>
      {items.map((t) => (
        <span key={t} className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
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
    <pre className="mt-2 overflow-x-auto rounded-xl bg-ink/[0.03] p-3 text-xs leading-relaxed">
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
                ? "bg-success-500/10 text-success-500"
                : l.type === "del"
                  ? "bg-danger-500/10 text-danger-500"
                  : "text-muted"
            }
          >
            <span className="select-none opacity-60">
              {l.type === "add" ? "+ " : l.type === "del" ? "- " : "  "}
            </span>
            {l.text || " "}
          </div>
        ),
      )}
    </pre>
  );
}

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="animate-float-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">成长轨迹</h1>
          <p className="mt-1 text-sm text-muted">
            每答完一个关键词，AI 都会更新对你的画像。这里能看到它如何一步步变清晰。
          </p>
        </div>
        <Link
          href="/profile"
          className="shrink-0 rounded-xl border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
        >
          我的资料
        </Link>
      </div>

      {snapshots.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-brand-200 bg-white/60 p-10 text-center">
          <p className="text-muted">
            还没有画像记录。完成第一个关键词后，这里会出现你的第一张画像卡片。
          </p>
          <Link
            href="/learn"
            className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2 font-semibold text-white"
          >
            去闯关 →
          </Link>
        </div>
      ) : (
        <>
          {/* 当前画像概览 */}
          <section className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">当前画像</h2>
              <span className="text-xs text-muted">已更新 {memory?.updateCount ?? 0} 次</span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink">
              {memory?.portrait || "（暂无）"}
            </pre>
          </section>

          {/* 时间线 */}
          <ol className="relative mt-8 border-l-2 border-brand-100 pl-6">
            {snapshots.map((s) => {
              const d = parseDiff(s.diff);
              const diffLines = lineDiff(d.prevPortrait, d.newPortrait);
              const noTagChange =
                d.addedStrengths.length +
                  d.addedWeaknesses.length +
                  d.addedBlindSpots.length +
                  d.addedInterests.length ===
                0;
              return (
                <li key={s.id} className="mb-6">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-brand-50" />
                  <div className="rounded-2xl border border-brand-100 bg-white/90 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink">第 {s.seq} 次更新</span>
                      <span className="text-sm text-muted">·</span>
                      <span className="text-sm text-ink">关键词「{s.keywordTerm}」</span>
                      {scoreBadge(s.finalScore)}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <AddChips label="新增强项" items={d.addedStrengths} color="bg-success-500/15 text-success-500" />
                      <AddChips label="新增待加强" items={d.addedWeaknesses} color="bg-accent-500/15 text-accent-500" />
                      <AddChips label="新增盲区" items={d.addedBlindSpots} color="bg-danger-500/15 text-danger-500" />
                      <AddChips label="新增兴趣" items={d.addedInterests} color="bg-brand-100 text-brand-700" />
                      {noTagChange && d.portraitChanged && (
                        <span className="text-xs text-muted">画像微调</span>
                      )}
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-brand-700">
                        查看画像变化（diff）
                      </summary>
                      <GitDiff lines={diffLines} />
                    </details>
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
