"use client";

import { useTransition } from "react";
import { shiftWeeksAction } from "@/app/actions/admin";

export function ScheduleControls() {
  const [pending, start] = useTransition();
  const shift = (d: number) => start(async () => void (await shiftWeeksAction(d)));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => shift(-1)}
        className="rounded-lg border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
      >
        ← 回退一周
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => shift(1)}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        快进一周 →
      </button>
    </div>
  );
}
