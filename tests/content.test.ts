import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "@/lib/store";
import { syncContent, writeUnitsFile } from "@/lib/content";

describe("content sync", () => {
  let home: string;
  let contentDir: string;
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-home-"));
    contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "rolldeep-content-"));
    store = createStore({ homeDir: home, timezone: "UTC" });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("pulls units from content/units json files into the pool", () => {
    writeUnitsFile(
      {
        title: "Optics",
        units: [
          {
            title: "Double slit",
            question: "If light is a wave, why is the screen not uniformly grey?",
            minutes: 35,
            sourceExcerpt: "Interference",
          },
        ],
      },
      contentDir,
    );
    const result = syncContent(store, contentDir);
    expect(result.added).toBe(1);
    expect(store.pool()[0]?.title).toBe("Double slit");
  });

  it("does not resurrect titles that are already in the store", () => {
    writeUnitsFile(
      {
        title: "Optics",
        units: [
          {
            title: "Double slit",
            question: "If light is a wave, why is the screen not uniformly grey?",
            minutes: 35,
          },
        ],
      },
      contentDir,
    );
    syncContent(store, contentDir);
    const again = syncContent(store, contentDir);
    expect(again.added).toBe(0);
    expect(again.skipped).toBe(1);
    expect(store.status().available).toBe(1);
  });
});
