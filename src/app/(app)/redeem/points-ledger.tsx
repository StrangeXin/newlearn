"use client";

import { useMemo, useState } from "react";
import type { LedgerEntryView } from "@/lib/redemption";

const TYPE: Record<string, { label: string; cls: string }> = {
  BASE: { label: "通关积分", cls: "badge badge-success" },
  RANK_BONUS: { label: "排名奖励", cls: "badge badge-gold" },
  REDEEM: { label: "兑换扣减", cls: "badge badge-muted" },
};

const FILTERS = [
  { key: "ALL", label: "全部" },
  { key: "EARN", label: "赚分" },
  { key: "REDEEM", label: "兑换" },
];

const dateFmt = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });

export function PointsLedger({ entries }: { entries: LedgerEntryView[] }) {
  const [filter, setFilter] = useState("ALL");

  const view = useMemo(
    () =>
      entries.filter((e) => {
        if (filter === "EARN") return e.type !== "REDEEM";
        if (filter === "REDEEM") return e.type === "REDEEM";
        return true;
      }),
    [entries, filter],
  );

  if (entries.length === 0) {
    return (
      <div className="card px-6 py-8 text-center text-sm text-muted">
        还没有积分流水。通关关键词、拿章节排名后，每一笔进账都会记在这里。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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

      {view.length === 0 ? (
        <div className="card px-6 py-8 text-center text-sm text-muted">没有这类流水。</div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {view.map((e) => {
            const t = TYPE[e.type] ?? TYPE.BASE;
            const pos = e.amount >= 0;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`${t.cls} shrink-0`}>{t.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{e.memo}</span>
                  {e.source && <span className="text-xs text-muted">{e.source}</span>}
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    pos ? "text-accent-700" : "text-danger-600"
                  }`}
                >
                  {pos ? "+" : ""}
                  {e.amount}
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-muted">
                  {dateFmt.format(new Date(e.createdAt))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
