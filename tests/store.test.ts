import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import {
  EmptyPoolError,
  ActiveTopicError,
  TopicNotActiveError,
  MissingProofError,
} from "@/lib/errors";
import type { NewUnit } from "@/lib/types";

function unit(overrides: Partial<NewUnit> & Pick<NewUnit, "title">): NewUnit {
  return {
    question: `Why does ${overrides.title} work the way it does?`,
    minutes: 40,
    sourceExcerpt: "ch 1",
    ...overrides,
  };
}

describe("store", () => {
  let dir: string;
  let store: ReturnType<typeof createStore>;
  const now = new Date("2026-08-21T15:00:00.000Z");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-"));
    store = createStore({ homeDir: dir, now: () => now, timezone: "UTC" });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rolls exactly one available topic into the session tray", () => {
    store.addUnits("Algebra", "raw", [unit({ title: "Completing the square" })]);
    const rolled = store.roll();
    expect(rolled.title).toBe("Completing the square");
    expect(rolled.status).toBe("rolled");
    expect(rolled.minutes).toBe(40);
    expect(rolled.stars).toBe(3);
    expect(store.status().current?.id).toBe(rolled.id);
    expect(store.status().inProgress).toBeNull();
    expect(store.status().available).toBe(0);
    store.choose(rolled.id);
    expect(store.status().inProgress?.id).toBe(rolled.id);
  });

  it("never draws a completed topic", () => {
    store.addUnits("S", "raw", [
      unit({ title: "Done already" }),
      unit({ title: "Still open" }),
    ]);
    const first = store.roll();
    store.choose(first.id);
    store.complete(first.id, { notes: "shot", videoUrl: "https://example.com/v" });
    const second = store.roll();
    expect(second.title).not.toBe(first.title);
    expect(["Done already", "Still open"]).toContain(second.title);
    expect(store.library().map((t) => t.title)).toEqual([first.title]);
  });

  it("rejects a second roll after a topic is chosen", () => {
    store.addUnits("S", "raw", [
      unit({ title: "A" }),
      unit({ title: "B" }),
    ]);
    const rolled = store.roll();
    store.choose(rolled.id);
    expect(() => store.roll()).toThrow(ActiveTopicError);
  });

  it("rejects roll on an empty pool", () => {
    expect(() => store.roll()).toThrow(EmptyPoolError);
  });

  it("increments streak on first roll of a day only", () => {
    store.addUnits("S", "raw", [unit({ title: "A" }), unit({ title: "B" })]);
    const first = store.roll();
    expect(store.status().currentStreak).toBe(1);
    store.choose(first.id);
    store.complete(first.id, { videoUrl: "https://example.com/v" });
    store.roll();
    expect(store.status().currentStreak).toBe(1);
  });

  it("skips duplicate titles case-insensitively within a syllabus", () => {
    const first = store.addUnits("S", "raw", [unit({ title: "Bayes theorem" })]);
    const again = store.addUnits("S", "raw", [
      unit({ title: "BAYES THEOREM" }),
      unit({ title: "Likelihood" }),
    ]);
    expect(first.syllabusId).toBe(again.syllabusId);
    expect(first.added).toBe(1);
    expect(again.added).toBe(1);
    expect(again.skipped).toBe(1);
    expect(store.status().available).toBe(2);
  });

  it("clamps minutes into 25–60", () => {
    store.addUnits("S", "raw", [
      unit({ title: "Short", minutes: 5 }),
      unit({ title: "Long", minutes: 180 }),
    ]);
    const titles = new Set<string>();
    const a = store.roll();
    titles.add(a.title);
    expect(a.minutes).toBeGreaterThanOrEqual(25);
    expect(a.minutes).toBeLessThanOrEqual(60);
    store.choose(a.id);
    store.complete(a.id, { videoUrl: "https://example.com/v" });
    const b = store.roll();
    titles.add(b.title);
    expect(b.minutes).toBeGreaterThanOrEqual(25);
    expect(b.minutes).toBeLessThanOrEqual(60);
    expect(titles.size).toBe(2);
  });

  it("only completes the active topic", () => {
    store.addUnits("S", "raw", [unit({ title: "A" })]);
    expect(() => store.complete("nope", { videoUrl: "https://example.com/v" })).toThrow(
      TopicNotActiveError,
    );
    const rolled = store.roll();
    store.choose(rolled.id);
    store.complete(rolled.id, { notes: "ok", videoUrl: "https://example.com/v" });
    expect(store.status().inProgress).toBeNull();
    expect(store.status().completed).toBe(1);
  });

  it("searches the completed library", () => {
    store.addUnits("S", "raw", [
      unit({ title: "Fourier series", question: "Why sines?" }),
      unit({ title: "Laplace", question: "Why transform?" }),
    ]);
    const first = store.roll();
    store.choose(first.id);
    store.complete(first.id, { notes: "board work", videoUrl: "https://example.com/v" });
    const second = store.roll();
    store.choose(second.id);
    store.complete(second.id, { videoUrl: "https://example.com/v" });
    const hits = store.library("sine");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe("Fourier series");
  });

  it("refuses to complete without proof", () => {
    store.addUnits("S", "raw", [unit({ title: "A" })]);
    const rolled = store.roll();
    store.choose(rolled.id);
    expect(() => store.complete(rolled.id, { notes: "no clip" })).toThrow(MissingProofError);
    expect(store.status().inProgress?.id).toBe(rolled.id);
  });

  it("deletes available units but refuses completed ones", () => {
    store.addUnits("S", "raw", [unit({ title: "Keep" }), unit({ title: "Drop" })]);
    const drop = store.pool().find((t) => t.title === "Drop")!;
    store.deleteAvailable(drop.id);
    expect(store.status().available).toBe(1);
    const keep = store.roll();
    store.choose(keep.id);
    store.complete(keep.id, { videoUrl: "https://example.com/v" });
    expect(() => store.deleteAvailable(keep.id)).toThrow();
  });
});
