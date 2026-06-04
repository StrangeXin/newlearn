// ===========================================================================
// src/lib/schedule.ts —— 周期/解锁机制（PRD §7）。
// 管理员开启学科时设 startDate；自然周(周一~周日)为界；第 N 周解锁第 N 章。
// 旧章保持解锁（index <= 当前周即解锁），可随时补完。
// ===========================================================================

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 某日期所在自然周的周一 00:00（本地时区）。 */
export function weekStartOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // 0=周一 .. 6=周日
  x.setDate(x.getDate() - dow);
  return x;
}

/** 自 startDate 起的自然周序号（开始周为第 1 周）。 */
export function weekIndexFor(startDate: Date, at: Date): number {
  const s = weekStartOf(startDate).getTime();
  const a = weekStartOf(at).getTime();
  return Math.floor((a - s) / WEEK_MS) + 1;
}

export interface ScheduleInfo {
  started: boolean;
  startDate: Date | null;
  /** 当前是第几周（未开启为 0）。 */
  currentWeek: number;
  /** 本周周日 23:59:59（用于「错过当周」判定与展示）。 */
  weekEndsAt: Date | null;
}

export function getScheduleInfo(
  subject: { startDate: Date | null } | null,
  now: Date = new Date(),
): ScheduleInfo {
  if (!subject?.startDate) {
    return { started: false, startDate: null, currentWeek: 0, weekEndsAt: null };
  }
  const currentWeek = Math.max(1, weekIndexFor(subject.startDate, now));
  const weekStart = weekStartOf(now);
  const weekEndsAt = new Date(weekStart.getTime() + WEEK_MS - 1000);
  return { started: true, startDate: subject.startDate, currentWeek, weekEndsAt };
}

/** 第 index 章是否已解锁（第 N 周解锁第 N 章；已解锁的旧章保持开放）。 */
export function isChapterUnlocked(
  subject: { startDate: Date | null } | null,
  index: number,
  now: Date = new Date(),
): boolean {
  const { started, currentWeek } = getScheduleInfo(subject, now);
  return started && index <= currentWeek;
}
