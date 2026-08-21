export function todayInTz(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseYmd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function isNextCalendarDay(previous: string, next: string): boolean {
  return parseYmd(next).getTime() - parseYmd(previous).getTime() === 86_400_000;
}

export function nextStreak(
  current: number,
  lastRollDate: string | null,
  today: string,
): { currentStreak: number; lastRollDate: string } {
  if (lastRollDate === today) {
    return { currentStreak: current, lastRollDate };
  }
  if (lastRollDate && isNextCalendarDay(lastRollDate, today)) {
    return { currentStreak: current + 1, lastRollDate: today };
  }
  return { currentStreak: 1, lastRollDate: today };
}
