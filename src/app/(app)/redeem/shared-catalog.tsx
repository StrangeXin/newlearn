"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addFeedbackAction, type RedeemState } from "@/app/actions/redemption";
import type { SharedRedemption } from "@/lib/redemption";

const CAT: Record<string, { label: string; cls: string }> = {
  BOOK: { label: "书籍", cls: "badge badge-brand" },
  TOOL: { label: "工具", cls: "badge badge-success" },
  COURSE: { label: "课程·会员", cls: "badge badge-gold" },
  OTHER: { label: "其他", cls: "badge badge-muted" },
};

const SENT: Record<string, { label: string; cls: string }> = {
  UP: { label: "推荐", cls: "text-success-600" },
  MEH: { label: "一般", cls: "text-muted" },
  DOWN: { label: "不推荐", cls: "text-danger-600" },
};

const FILTERS = [
  { key: "ALL", label: "全部" },
  { key: "BOOK", label: "书籍" },
  { key: "TOOL", label: "工具" },
  { key: "COURSE", label: "课程·会员" },
  { key: "OTHER", label: "其他" },
];

const dateFmt = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });
const fmtDate = (d: Date) => dateFmt.format(new Date(d));

function FeedbackForm({ redemptionId }: { redemptionId: string }) {
  const [state, action, pending] = useActionState(addFeedbackAction, {} as RedeemState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-3 border-t border-line pt-3">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="sentiment" defaultValue="" className="input h-9 w-24 text-sm" aria-label="倾向">
          <option value="">倾向</option>
          <option value="UP">推荐</option>
          <option value="MEH">一般</option>
          <option value="DOWN">不推荐</option>
        </select>
        <input
          name="content"
          required
          maxLength={500}
          placeholder="留一句使用感受，方便同事参考"
          className="input h-9 min-w-[12rem] flex-1 text-sm"
        />
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm shrink-0">
          {pending ? "提交中…" : "发布反馈"}
        </button>
      </div>
      {state?.error && <p className="field-error mt-1.5">{state.error}</p>}
    </form>
  );
}

export function SharedCatalog({ items }: { items: SharedRedemption[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== "ALL" && it.category !== cat) return false;
      if (kw && !it.item.toLowerCase().includes(kw) && !it.ownerName.toLowerCase().includes(kw))
        return false;
      return true;
    });
  }, [items, q, cat]);

  if (items.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-sm text-muted">
        还没有人兑换通过的物品。等大家兑了书或工具，这里就能看到、互相借用。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索物品或持有人"
          className="input h-9 w-full max-w-xs"
          aria-label="搜索物品或持有人"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setCat(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                cat === f.key
                  ? "bg-brand-600 text-white"
                  : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {view.length === 0 ? (
        <div className="card px-6 py-8 text-center text-sm text-muted">没有符合条件的物品。</div>
      ) : (
        <ul className="space-y-3">
          {view.map((it) => {
            const c = CAT[it.category] ?? CAT.OTHER;
            return (
              <li key={it.id} className="rounded-xl border border-line bg-surface px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">{it.item}</h3>
                      <span className={c.cls}>{c.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      <span className="font-medium text-ink">{it.ownerName}</span> 持有 ·{" "}
                      {fmtDate(it.createdAt)} 兑换
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums text-accent-700">{it.amount}</div>
                    <div className="text-xs text-muted">积分</div>
                  </div>
                </div>

                {it.feedback.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {it.feedback.map((f) => {
                      const s = f.sentiment ? SENT[f.sentiment] : null;
                      return (
                        <li key={f.id} className="text-sm leading-relaxed">
                          {s && <span className={`mr-1.5 font-medium ${s.cls}`}>{s.label}</span>}
                          <span className="font-medium text-ink">{f.authorName}</span>
                          <span className="text-muted">：{f.content}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <details className="details-chevron mt-1">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 pt-2 text-xs font-medium text-brand-700">
                    <span>我来反馈</span>
                    <span className="rc" aria-hidden />
                  </summary>
                  <FeedbackForm redemptionId={it.id} />
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
