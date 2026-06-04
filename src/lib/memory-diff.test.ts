import { describe, expect, it } from "vitest";
import { computeMemoryDiff, lineDiff } from "./memory-diff";

const tags = (s: string[], w: string[] = [], i: string[] = [], b: string[] = []) => ({
  strengths: s,
  weaknesses: w,
  interests: i,
  blindSpots: b,
});

describe("computeMemoryDiff", () => {
  it("只把新增项算入 added*", () => {
    const d = computeMemoryDiff(
      tags(["A"]),
      tags(["A", "B"], ["C"]),
      "旧画像",
      "新画像",
    );
    expect(d.addedStrengths).toEqual(["B"]);
    expect(d.addedWeaknesses).toEqual(["C"]);
    expect(d.portraitChanged).toBe(true);
  });

  it("画像未变时 portraitChanged=false", () => {
    const d = computeMemoryDiff(tags([]), tags([]), "同样", "同样");
    expect(d.portraitChanged).toBe(false);
  });
});

describe("lineDiff（git 风格按行对比）", () => {
  it("空 → 文本：全部为新增", () => {
    const out = lineDiff("", "第一行\n第二行");
    expect(out.every((l) => l.type === "add")).toBe(true);
    expect(out.map((l) => l.text)).toEqual(["第一行", "第二行"]);
  });

  it("插入一行：其余为 ctx，新行为 add", () => {
    const out = lineDiff("# 标题\n- A", "# 标题\n- A\n- B");
    expect(out.filter((l) => l.type === "ctx").map((l) => l.text)).toEqual(["# 标题", "- A"]);
    expect(out.filter((l) => l.type === "add").map((l) => l.text)).toEqual(["- B"]);
    expect(out.some((l) => l.type === "del")).toBe(false);
  });

  it("替换一行：产生一删一增", () => {
    const out = lineDiff("- 完成「X」，得分 70", "- 完成「Y」，得分 90");
    expect(out.some((l) => l.type === "del")).toBe(true);
    expect(out.some((l) => l.type === "add")).toBe(true);
  });
});
