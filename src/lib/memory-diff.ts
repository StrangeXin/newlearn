// ===========================================================================
// src/lib/memory-diff.ts —— 画像快照的纯工具（无 prisma / 无 @ 别名依赖）。
// 供生产 applyMemoryUpdate、种子模拟、页面渲染共用。
// ===========================================================================

import type { LearnerMemoryTags } from "./scoring/types";

export interface MemoryDiff {
  addedStrengths: string[];
  addedWeaknesses: string[];
  addedInterests: string[];
  addedBlindSpots: string[];
  portraitChanged: boolean;
  prevPortrait: string;
  newPortrait: string;
}

const added = (prev: string[], next: string[]): string[] =>
  next.filter((x) => !prev.includes(x));

/** 计算「新标签相对旧标签」的增量 + 画像是否变化。 */
export function computeMemoryDiff(
  prev: LearnerMemoryTags,
  next: LearnerMemoryTags,
  prevPortrait: string,
  newPortrait: string,
): MemoryDiff {
  return {
    addedStrengths: added(prev.strengths, next.strengths),
    addedWeaknesses: added(prev.weaknesses, next.weaknesses),
    addedInterests: added(prev.interests, next.interests),
    addedBlindSpots: added(prev.blindSpots, next.blindSpots),
    portraitChanged: prevPortrait !== newPortrait,
    prevPortrait,
    newPortrait,
  };
}

export function diffHasChanges(d: MemoryDiff): boolean {
  return (
    d.addedStrengths.length > 0 ||
    d.addedWeaknesses.length > 0 ||
    d.addedInterests.length > 0 ||
    d.addedBlindSpots.length > 0 ||
    d.portraitChanged
  );
}

const strArr = (x: unknown): string[] =>
  Array.isArray(x) ? x.map((i) => String(i)).filter((s) => s.trim()) : [];

/** 把存库的 Json 安全解析为结构化标签（缺字段回退空数组）。 */
export function parseTags(value: unknown): LearnerMemoryTags {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    strengths: strArr(v.strengths),
    weaknesses: strArr(v.weaknesses),
    interests: strArr(v.interests),
    blindSpots: strArr(v.blindSpots),
  };
}

// ---------------------------- 画像按行 git-diff ----------------------------

export type DiffLineType = "add" | "del" | "ctx";
export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * 基于 LCS 的逐行 diff（画像是 Markdown 文档，按行对比最直观，类似 git diff）。
 * 返回有序行序列：ctx=未变、add=新增(+)、del=删除(-)。
 */
export function lineDiff(prev: string, next: string): DiffLine[] {
  const a = prev ? prev.split("\n") : [];
  const b = next ? next.split("\n") : [];
  const n = a.length;
  const m = b.length;
  // dp[i][j] = a[i..]、b[j..] 的 LCS 长度
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i += 1;
    } else {
      out.push({ type: "add", text: b[j] });
      j += 1;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

/** 把存库的 Json 安全解析为 MemoryDiff。 */
export function parseDiff(value: unknown): MemoryDiff {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    addedStrengths: strArr(v.addedStrengths),
    addedWeaknesses: strArr(v.addedWeaknesses),
    addedInterests: strArr(v.addedInterests),
    addedBlindSpots: strArr(v.addedBlindSpots),
    portraitChanged: Boolean(v.portraitChanged),
    prevPortrait: typeof v.prevPortrait === "string" ? v.prevPortrait : "",
    newPortrait: typeof v.newPortrait === "string" ? v.newPortrait : "",
  };
}
