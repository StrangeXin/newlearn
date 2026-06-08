// ===========================================================================
// src/components/growth-timeline.tsx —— 画像与成长轨迹的共享渲染（PRD §14.5）。
// 从 /growth 抽出，供「我的成长」页与管理后台「员工学情」详情页共用同一套渲染：
//   - PortraitCard：当前画像（强项 / 待加强·盲区 / 兴趣 chips + 画像全文）
//   - GrowthTimeline：逐次更新的时间线（新增标签 + 画像按行 git-diff）
// 纯展示，不做脱敏（脱敏只在同伴互看路径 social.ts，管理/本人均看全）。
// ===========================================================================

import { Eye } from "lucide-react";
import { type DiffLine, lineDiff, parseDiff } from "@/lib/memory-diff";
import type { LearnerMemoryTags } from "@/lib/scoring";
import { ExpandableText } from "@/components/expandable-text";

const dateFmt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" });

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
    const near = l.type !== "ctx" || lines[i - 1]?.type !== "ctx" || lines[i + 1]?.type !== "ctx";
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

/** 当前画像卡：强项 / 待加强·盲区 / 兴趣 chips + 画像全文（Markdown，默认展开）。 */
export function PortraitCard({
  tags,
  portrait,
}: {
  tags: LearnerMemoryTags;
  portrait: string;
}) {
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];
  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-ink">当前画像</h2>
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
          <ExpandableText markdown text={portrait || "画像正文会随作答逐步补全。"} />
        </div>
      </div>
    </div>
  );
}

/** 成长轨迹时间线的一条快照（与 EmployeeMemorySnapshot 对齐，仅取渲染所需字段）。 */
export interface GrowthSnapshot {
  id: string;
  seq: number;
  finalScore: number;
  keywordTerm: string;
  createdAt: Date;
  diff: unknown;
}

/** 成长轨迹：按时间倒序，每条展示新增标签 + 画像按行 git-diff。 */
export function GrowthTimeline({ snapshots }: { snapshots: GrowthSnapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="card p-6 text-center text-sm text-muted">还没有画像记录。</p>;
  }
  return (
    <ol className="relative border-l-2 border-line pl-5 sm:pl-6">
      {[...snapshots].reverse().map((s, i) => {
        const d = parseDiff(s.diff);
        const diffLines = lineDiff(d.prevPortrait, d.newPortrait);
        const hasAdds =
          d.addedStrengths.length +
            d.addedWeaknesses.length +
            d.addedBlindSpots.length +
            d.addedInterests.length >
          0;
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
                <span className="shrink-0 text-xs text-muted">{dateFmt.format(s.createdAt)}</span>
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
  );
}
