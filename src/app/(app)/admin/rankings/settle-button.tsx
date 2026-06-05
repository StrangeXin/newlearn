"use client";

import { useState, useTransition } from "react";
import { settleChapterAction } from "@/app/actions/ranking";

export function SettleButton({ chapterId }: { chapterId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const isError = msg.startsWith("✗");

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            isError ? "text-danger-600" : "text-success-600"
          }`}
        >
          {msg}
        </span>
      )}
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
        className="btn btn-primary btn-sm shrink-0"
      >
        {pending ? "结算中…" : "结算本章排名"}
      </button>
    </div>
  );
}
