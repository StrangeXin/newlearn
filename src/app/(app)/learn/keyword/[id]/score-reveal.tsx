"use client";

import { useEffect, useState } from "react";

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

function Confetti() {
  // 12 片，确定性方向（按索引散开）
  const pieces = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 60 + (i % 3) * 16;
    return {
      dx: `${Math.cos(angle) * dist}px`,
      dy: `${Math.sin(angle) * dist - 20}px`,
      rot: `${(i % 2 ? 1 : -1) * 240}deg`,
      color: COLORS[i % COLORS.length],
      delay: `${(i % 4) * 30}ms`,
    };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute block h-2 w-2 rounded-[2px]"
          style={
            {
              backgroundColor: p.color,
              animationDelay: p.delay,
              "--dx": p.dx,
              "--dy": p.dy,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function ScoreReveal({ value, passed }: { value: number; passed: boolean }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    let startTs: number | null = null;
    const dur = 700;
    const tick = (t: number) => {
      if (startTs === null) startTs = t;
      const p = Math.min(1, (t - startTs) / dur);
      setN(Math.round(value * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="relative inline-block">
      {passed && <Confetti />}
      <div
        className={`animate-pop text-5xl font-extrabold ${
          passed ? "text-success-500" : "text-accent-500"
        }`}
      >
        {n}
      </div>
    </div>
  );
}
