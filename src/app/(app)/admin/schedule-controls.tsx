"use client";

import { useTransition } from "react";
import { shiftWeeksAction } from "@/app/actions/admin";

export function ScheduleControls({ subjectId }: { subjectId: string }) {
  const [pending, start] = useTransition();
  const shift = (d: number) => start(async () => void (await shiftWeeksAction(subjectId, d)));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => shift(-1)}
        className="btn btn-danger btn-sm"
        title="回退会重新锁住已解锁的关卡"
      >
        ← 回退一周
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => shift(1)}
        className="btn btn-secondary btn-sm"
      >
        快进一周 →
      </button>
      {pending && <span className="text-xs text-muted">调整中…</span>}
    </div>
  );
}
