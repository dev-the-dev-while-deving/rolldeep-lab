import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import { ActiveTopicError, UnknownSyllabusError } from "@/lib/errors";
import type { NewUnit } from "@/lib/types";

function unit(title: string): NewUnit {
  return {
    title,
    question: `Why ${title}?`,
    minutes: 40,
    stars: 3,
    sourceExcerpt: "t",
  };
}

describe("multiple syllabi", () => {
  let dir: string;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-syl-"));
    store = createStore({ homeDir: dir, timezone: "UTC" });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("upserts the same syllabus title instead of duplicating it", () => {
    const first = store.addUnits("DAA", "raw", [unit("Dijkstra")]);
    const second = store.addUnits("DAA", "raw2", [unit("Dijkstra"), unit("Bellman-Ford")]);
    expect(second.syllabusId).toBe(first.syllabusId);
    expect(second.added).toBe(1);
    expect(second.skipped).toBe(1);
    expect(store.syllabi()).toHaveLength(1);
    expect(store.status().available).toBe(2);
  });

  it("lets two syllabi share a topic title and keeps completion separate", () => {
    const daa = store.addUnits("DAA", "raw", [unit("Trees"), unit("Heaps")]);
    const discrete = store.addUnits("Discrete", "raw", [unit("Trees"), unit("Graphs")]);
    expect(daa.added).toBe(2);
    expect(discrete.added).toBe(2);

    store.setActiveSyllabus(daa.syllabusId);
    const rolled = store.roll();
    store.choose(rolled.id);
    store.complete(rolled.id, { videoUrl: "https://example.com/v" });
    expect(store.status().completed).toBe(1);
    expect(store.status().available).toBe(1);

    store.setActiveSyllabus(discrete.syllabusId);
    expect(store.status().completed).toBe(0);
    expect(store.status().available).toBe(2);
    expect(store.library()).toEqual([]);
    expect(store.pool().map((topic) => topic.title).sort()).toEqual(["Graphs", "Trees"]);

    store.setActiveSyllabus(daa.syllabusId);
    expect(store.status().completed).toBe(1);
    expect(store.library()).toHaveLength(1);
  });

  it("keeps session trays and roll caps isolated per syllabus", () => {
    const daa = store.addUnits(
      "DAA",
      "raw",
      ["A1", "A2", "A3", "A4", "A5", "A6"].map(unit),
    );
    const calc = store.addUnits("Calc", "raw", ["B1", "B2", "B3"].map(unit));

    store.setActiveSyllabus(daa.syllabusId);
    const first = store.roll();
    const second = store.roll();
    expect(store.status().rollsUsed).toBe(2);
    expect(store.status().current?.id).toBe(second.id);
    expect(store.status().previous[0]?.id).toBe(first.id);

    store.setActiveSyllabus(calc.syllabusId);
    expect(store.status().rollsUsed).toBe(0);
    expect(store.status().current).toBeNull();
    expect(store.status().previous).toEqual([]);
    const other = store.roll();
    expect(other.syllabusId).toBe(calc.syllabusId);
    expect(store.status().rollsUsed).toBe(1);

    store.setActiveSyllabus(daa.syllabusId);
    expect(store.status().rollsUsed).toBe(2);
    expect(store.status().current?.id).toBe(second.id);
    expect(store.status().previous[0]?.id).toBe(first.id);
  });

  it("allows an in-progress topic on one syllabus while rolling another", () => {
    const daa = store.addUnits("DAA", "raw", [unit("A"), unit("B")]);
    const calc = store.addUnits("Calc", "raw", [unit("C"), unit("D")]);
    store.setActiveSyllabus(daa.syllabusId);
    const rolled = store.roll();
    store.choose(rolled.id);
    expect(() => store.roll()).toThrow(ActiveTopicError);

    store.setActiveSyllabus(calc.syllabusId);
    const other = store.roll();
    expect(other.syllabusId).toBe(calc.syllabusId);
    expect(store.status().inProgress).toBeNull();

    store.setActiveSyllabus(daa.syllabusId);
    expect(store.status().inProgress?.id).toBe(rolled.id);
  });

  it("exposes syllabus list and completion on status", () => {
    const daa = store.addUnits("DAA", "raw", [unit("A"), unit("B")]);
    store.addUnits("Calc", "raw", [unit("C")]);
    store.setActiveSyllabus(daa.syllabusId);
    const rolled = store.roll();
    store.choose(rolled.id);
    store.complete(rolled.id, { videoUrl: "https://example.com/v" });

    const status = store.status();
    expect(status.activeSyllabusId).toBe(daa.syllabusId);
    expect(status.activeSyllabusTitle).toBe("DAA");
    expect(status.syllabi).toHaveLength(2);
    const active = status.syllabi.find((row) => row.id === daa.syllabusId);
    expect(active?.completed).toBe(1);
    expect(active?.available).toBe(1);
    expect(active?.unitCount).toBe(2);
  });

  it("rejects an unknown syllabus id", () => {
    expect(() => store.setActiveSyllabus("nope")).toThrow(UnknownSyllabusError);
  });
});

describe("duplicate syllabus collapse", () => {
  it("merges same-title syllabi into the one that already has units", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-collapse-"));
    const first = createStore({ homeDir: dir, timezone: "UTC" });
    first.addUnits("DAA", "raw", [unit("Dijkstra")]);
    first.close();

    const { default: Database } = await import("better-sqlite3");
    const { dbPathFor } = await import("@/lib/paths");
    const sqlite = new Database(dbPathFor(dir));
    sqlite
      .prepare(
        `INSERT INTO syllabi (id, title, raw_text, status, error, created_at)
         VALUES ('ghost', 'DAA', 'x', 'ready', NULL, 1)`,
      )
      .run();
    sqlite.close();

    const store = createStore({ homeDir: dir, timezone: "UTC" });
    expect(store.syllabi()).toHaveLength(1);
    expect(store.syllabi()[0]?.unitCount).toBe(1);
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
