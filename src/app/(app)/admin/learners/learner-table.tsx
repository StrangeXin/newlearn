"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LearnerRosterRow, LearnerStatus } from "@/lib/stats";

const STATUS: Record<LearnerStatus, { text: string; cls: string }> = {
  inactive: { text: "未激活", cls: "badge badge-muted" },
  notStarted: { text: "未开始", cls: "badge badge-muted" },
  learning: { text: "学习中", cls: "badge badge-brand" },
  completed: { text: "已学满", cls: "badge badge-success" },
};

type Filter = "all" | "behind" | "inactive";
type Sort = "progress" | "avg" | "active" | "name";

const SORTS: { key: Sort; label: string }[] = [
  { key: "progress", label: "进度" },
  { key: "avg", label: "均分" },
  { key: "active", label: "最近活跃" },
  { key: "name", label: "姓名" },
];

function relDay(d: Date | null): string {
  if (!d) return "—";
  const date = new Date(d);
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(date);
  b.setHours(0, 0, 0, 0);
  const days = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function LearnerTable({
  rows,
  totalKeywords,
  subjectId,
}: {
  rows: LearnerRosterRow[];
  totalKeywords: number;
  subjectId: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("progress");

  const behindCount = useMemo(() => rows.filter((r) => r.behind).length, [rows]);
  const inactiveCount = useMemo(() => rows.filter((r) => !r.isActivated).length, [rows]);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter === "behind" && !r.behind) return false;
      if (filter === "inactive" && r.isActivated) return false;
      if (kw && !r.name.toLowerCase().includes(kw) && !r.department.toLowerCase().includes(kw))
        return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "avg":
          return b.avgScore - a.avgScore || b.completed - a.completed;
        case "active":
          return (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0);
        case "name":
          return a.name.localeCompare(b.name, "zh");
        default:
          return b.completed - a.completed || a.name.localeCompare(b.name, "zh");
      }
    });
  }, [rows, q, filter, sort]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `全部 ${rows.length}` },
    { key: "behind", label: `落后者 ${behindCount}` },
    { key: "inactive", label: `未激活 ${inactiveCount}` },
  ];

  return (
    <div className="mt-5">
      {/* 控件：搜索 + 筛选 chips + 排序 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索姓名或部门"
          className="input h-9 w-full max-w-xs"
          aria-label="搜索姓名或部门"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-brand-600 text-white"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <span>排序</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="input h-9 w-28"
            aria-label="排序方式"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 表头（桌面） */}
      <div className="mt-4 hidden items-center gap-3 px-4 text-xs font-medium text-muted sm:flex">
        <span className="w-28">姓名</span>
        <span className="w-16">部门</span>
        <span className="flex-1">进度</span>
        <span className="w-12 text-right">均分</span>
        <span className="w-12 text-right">赚分</span>
        <span className="w-16 text-center">状态</span>
        <span className="w-14 text-right">活跃</span>
      </div>

      {view.length === 0 ? (
        <div className="card mt-2 px-6 py-10 text-center text-sm text-muted">没有符合条件的员工。</div>
      ) : (
        <ul className="card mt-2 divide-y divide-line overflow-hidden">
          {view.map((r) => {
            const pct = totalKeywords > 0 ? Math.round((r.completed / totalKeywords) * 100) : 0;
            const st = STATUS[r.status];
            return (
              <li key={r.userId}>
                <Link
                  href={`/admin/learners/${r.userId}?subject=${subjectId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-surface-2 sm:flex-nowrap"
                >
                  <span className="flex w-28 min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium text-ink">{r.name}</span>
                    {r.behind && <span className="badge badge-danger shrink-0">落后</span>}
                  </span>
                  <span className="w-16 shrink-0 truncate text-xs text-muted">
                    {r.department || "—"}
                  </span>
                  <span className="flex min-w-[8rem] flex-1 items-center gap-2">
                    <span className="progress h-2 flex-1">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">
                      {r.completed}/{totalKeywords}
                    </span>
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums font-medium text-ink">
                    {r.avgScore || "—"}
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted">
                    {r.points}
                  </span>
                  <span className="w-16 shrink-0 text-center">
                    <span className={st.cls}>{st.text}</span>
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-muted">
                    {relDay(r.lastActiveAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
