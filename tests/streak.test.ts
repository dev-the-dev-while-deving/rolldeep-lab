import { describe, expect, it } from "vitest";
import { isNextCalendarDay, nextStreak, todayInTz } from "@/lib/streak";

describe("todayInTz", () => {
  it("formats a UTC instant as YYYY-MM-DD in the given zone", () => {
    const noonUtc = new Date("2026-08-21T12:00:00.000Z");
    expect(todayInTz("UTC", noonUtc)).toBe("2026-08-21");
    expect(todayInTz("America/Los_Angeles", noonUtc)).toBe("2026-08-21");
  });

  it("rolls the calendar date behind UTC in US Pacific evening UTC", () => {
    const lateUtc = new Date("2026-08-22T02:00:00.000Z");
    expect(todayInTz("UTC", lateUtc)).toBe("2026-08-22");
    expect(todayInTz("America/Los_Angeles", lateUtc)).toBe("2026-08-21");
  });
});

describe("isNextCalendarDay", () => {
  it("is true only for the immediately following calendar day", () => {
    expect(isNextCalendarDay("2026-08-21", "2026-08-22")).toBe(true);
    expect(isNextCalendarDay("2026-08-21", "2026-08-21")).toBe(false);
    expect(isNextCalendarDay("2026-08-21", "2026-08-23")).toBe(false);
    expect(isNextCalendarDay("2026-12-31", "2027-01-01")).toBe(true);
  });
});

describe("nextStreak", () => {
  it("starts at 1 on the first roll", () => {
    expect(nextStreak(0, null, "2026-08-21")).toEqual({
      currentStreak: 1,
      lastRollDate: "2026-08-21",
    });
  });

  it("does not increment twice on the same local day", () => {
    expect(nextStreak(4, "2026-08-21", "2026-08-21")).toEqual({
      currentStreak: 4,
      lastRollDate: "2026-08-21",
    });
  });

  it("increments when the previous roll was yesterday", () => {
    expect(nextStreak(4, "2026-08-20", "2026-08-21")).toEqual({
      currentStreak: 5,
      lastRollDate: "2026-08-21",
    });
  });

  it("resets to 1 after a gap", () => {
    expect(nextStreak(12, "2026-08-18", "2026-08-21")).toEqual({
      currentStreak: 1,
      lastRollDate: "2026-08-21",
    });
  });
});
