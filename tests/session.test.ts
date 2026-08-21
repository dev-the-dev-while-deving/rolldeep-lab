import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import { NotVisibleError, SessionRollLimitError } from "@/lib/errors";
import type { NewUnit } from "@/lib/types";

function unit(title: string, stars = 3): NewUnit {
  return {
    title,
    question: `Why ${title}?`,
    minutes: 40,
    stars,
    sourceExcerpt: "t",
  };
}

describe("session rolls", () => {
  let dir: string;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-"));
    store = createStore({ homeDir: dir, timezone: "UTC" });
    store.addUnits(
      "S",
      "raw",
      ["A", "B", "C", "D", "E", "F", "G"].map((title) => unit(title)),
    );
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("allows rerolls until five per session", () => {
    for (let i = 0; i < 5; i += 1) store.roll();
    expect(store.status().rollsUsed).toBe(5);
    expect(store.status().rollsLeft).toBe(0);
    expect(() => store.roll()).toThrow(SessionRollLimitError);
  });

  it("shows only the current roll plus three previous", () => {
    const rolled = Array.from({ length: 5 }, () => store.roll());
    const status = store.status();
    expect(status.current?.id).toBe(rolled[4]?.id);
    expect(status.previous).toHaveLength(3);
    expect(status.previous.map((topic) => topic.id)).toEqual([
      rolled[3]?.id,
      rolled[2]?.id,
      rolled[1]?.id,
    ]);
  });

  it("returns the oldest hidden roll to the pool", () => {
    const first = store.roll();
    store.roll();
    store.roll();
    store.roll();
    store.roll();
    const status = store.status();
    const visible = new Set(
      [status.current, ...status.previous].filter(Boolean).map((topic) => topic!.id),
    );
    expect(visible.has(first.id)).toBe(false);
    expect(store.getTopic(first.id)?.status).toBe("available");
  });

  it("lets you pick a previous visible roll and releases the rest", () => {
    const a = store.roll();
    const b = store.roll();
    store.roll();
    store.choose(a.id);
    expect(store.status().inProgress?.id).toBe(a.id);
    expect(store.getTopic(b.id)?.status).toBe("available");
    expect(store.status().previous).toEqual([]);
    expect(store.status().rollsLeft).toBe(5);
  });

  it("refuses to choose a roll that already fell out of the last three", () => {
    const first = store.roll();
    store.roll();
    store.roll();
    store.roll();
    store.roll();
    expect(() => store.choose(first.id)).toThrow(NotVisibleError);
  });

  it("clamps hardness stars to 1–5", () => {
    store.wipe();
    store.addUnits("H", "raw", [unit("Easy", 0), unit("Brutal", 9)]);
    const easy = store.pool().find((topic) => topic.title === "Easy");
    const brutal = store.pool().find((topic) => topic.title === "Brutal");
    expect(easy?.stars).toBe(1);
    expect(brutal?.stars).toBe(5);
  });
});
