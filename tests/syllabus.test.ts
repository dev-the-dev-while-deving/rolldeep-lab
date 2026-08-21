import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import { ingestSyllabus } from "@/lib/syllabus";

describe("ingestSyllabus", () => {
  let dir: string;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-"));
    store = createStore({ homeDir: dir, timezone: "UTC" });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("uses the generator and writes units into the pool", async () => {
    const result = await ingestSyllabus(store, {
      title: "Optics",
      rawText: "# Interference\n\nWaves.",
      generate: async () => [
        {
          title: "Young's double slit",
          question: "If light is a wave, why is the screen not uniformly grey?",
          minutes: 35,
          sourceExcerpt: "Interference",
        },
      ],
    });
    expect(result.added).toBe(1);
    expect(store.status().available).toBe(1);
    expect(store.pool()[0]?.question).toContain("uniformly grey");
  });
});
