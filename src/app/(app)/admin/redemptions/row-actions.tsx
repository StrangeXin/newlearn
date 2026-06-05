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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="field-error w-full text-right">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(rejectRedemptionAction)}
        className="btn btn-danger btn-sm"
      >
        驳回
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(approveRedemptionAction)}
        className="btn btn-primary btn-sm"
      >
        {pending ? "处理中…" : "通过审批"}
      </button>
    </div>
  );
}
