import { describe, expect, it } from "vitest";
import { getScheduleInfo, isChapterUnlocked, weekIndexFor } from "./schedule";

// 固定一个周一作为开课日
const start = new Date("2026-05-04T00:00:00"); // 周一

describe("weekIndexFor", () => {
  it("开课当周为第 1 周", () => {
    expect(weekIndexFor(start, new Date("2026-05-04T10:00:00"))).toBe(1);
    expect(weekIndexFor(start, new Date("2026-05-10T23:00:00"))).toBe(1); // 同周周日
  });
  it("下一周为第 2 周，依此类推", () => {
    expect(weekIndexFor(start, new Date("2026-05-11T00:00:00"))).toBe(2);
    expect(weekIndexFor(start, new Date("2026-05-25T12:00:00"))).toBe(4);
  });
});

describe("isChapterUnlocked", () => {
  const subject = { startDate: start };
  const now = new Date("2026-05-20T12:00:00"); // 第 3 周
  it("第 N 周解锁第 N 章；旧章保持解锁", () => {
    expect(isChapterUnlocked(subject, 1, now)).toBe(true);
    expect(isChapterUnlocked(subject, 3, now)).toBe(true);
    expect(isChapterUnlocked(subject, 4, now)).toBe(false);
    expect(isChapterUnlocked(subject, 5, now)).toBe(false);
  });
  it("未设开始日则全部锁定", () => {
    expect(isChapterUnlocked({ startDate: null }, 1, now)).toBe(false);
    expect(getScheduleInfo({ startDate: null }).currentWeek).toBe(0);
  });
});
