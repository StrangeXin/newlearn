"use client";

import { useState, useTransition } from "react";
import {
  approveRedemptionAction,
  rejectRedemptionAction,
} from "@/app/actions/redemption";

export function RowActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const run = (fn: (id: string) => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn(id);
      if (r?.error) setError(r.error);
    });

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger-500">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(rejectRedemptionAction)}
        className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-50 disabled:opacity-50"
      >
        驳回
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(approveRedemptionAction)}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "处理中…" : "通过"}
      </button>
    </div>
  );
}
