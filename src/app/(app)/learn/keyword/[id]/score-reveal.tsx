"use client";

import { useEffect, useState } from "react";

// 奖励瞬间：靛蓝 + 金 + 通过绿，角色一致的庆祝色
const COLORS = ["#2d55c0", "#e8b121", "#00ad71", "#5b7cf0", "#c98f12"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

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
  // 初始 0：动画从 0 起跳，无闪烁；SSR 也输出 0，客户端水合一致
  const [n, setN] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    // 减弱动效：直接显示终值，不做 count-up、不放彩屑
    // 媒体查询只能在水合后得知，故此处必须 setState（非初始可推导）
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(value);
      return;
    }
    setCelebrate(passed);
    let raf = 0;
    let startTs: number | null = null;
    const dur = 700;
    const tick = (t: number) => {
      if (startTs === null) startTs = t;
      const p = Math.min(1, (t - startTs) / dur);
      // ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, passed]);

  return (
    <div className="relative inline-block">
      {celebrate && <Confetti />}
      <div
        className={`animate-pop text-5xl font-extrabold tabular-nums ${
          passed ? "text-success-600" : "text-accent-700"
        }`}
      >
        {n}
      </div>
    </div>
  );
}
