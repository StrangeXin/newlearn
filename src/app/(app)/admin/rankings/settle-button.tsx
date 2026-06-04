"use client";

import { useState, useTransition } from "react";
import { settleChapterAction } from "@/app/actions/ranking";

export function SettleButton({ chapterId }: { chapterId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg("");
            const r = await settleChapterAction(chapterId);
            setMsg(r.error ? `✗ ${r.error}` : `✓ 已结算 ${r.count ?? 0} 人`);
          })
        }
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "结算中…" : "结算本章排名"}
      </button>
    </div>
  );
}
