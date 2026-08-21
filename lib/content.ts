import fs from "node:fs";
import path from "node:path";
import type { Store } from "@/lib/store";
import type { AddUnitsResult, NewUnit } from "@/lib/types";

export type UnitsFile = {
  title: string;
  units: NewUnit[];
};

export type SyncResult = AddUnitsResult & { files: number };

export function defaultContentDir(): string {
  return path.join(process.cwd(), "content");
}

export function unitsDir(contentDir = defaultContentDir()): string {
  return path.join(contentDir, "units");
}

export function syllabiDir(contentDir = defaultContentDir()): string {
  return path.join(contentDir, "syllabi");
}

function slug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "units";
}

export function parseUnitsFile(raw: string, fallbackTitle: string): UnitsFile {
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { title: fallbackTitle, units: parsed as NewUnit[] };
  }
  const object = parsed as { title?: unknown; units?: unknown };
  const units = Array.isArray(object.units) ? (object.units as NewUnit[]) : [];
  const title = typeof object.title === "string" && object.title.trim() ? object.title : fallbackTitle;
  return { title, units };
}

export function writeUnitsFile(file: UnitsFile, contentDir = defaultContentDir()): string {
  const dir = unitsDir(contentDir);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${slug(file.title)}.json`;
  const target = path.join(dir, filename);
  fs.writeFileSync(target, `${JSON.stringify({ title: file.title, units: file.units }, null, 2)}\n`);
  return target;
}

export function listSyllabi(contentDir = defaultContentDir()): { name: string; path: string }[] {
  const dir = syllabiDir(contentDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith(".") && !name.endsWith(".gitkeep"))
    .map((name) => ({ name, path: path.join(dir, name) }));
}

export function syncContent(store: Store, contentDir = defaultContentDir()): SyncResult {
  const dir = unitsDir(contentDir);
  if (!fs.existsSync(dir)) {
    return { syllabusId: "", added: 0, skipped: 0, files: 0 };
  }

  let added = 0;
  let skipped = 0;
  let files = 0;
  let syllabusId = "";

  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  const kept: string[] = [];
  for (const name of names) {
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const parsed = parseUnitsFile(raw, path.basename(name, ".json"));
    if (parsed.units.length === 0) continue;
    files += 1;
    kept.push(parsed.title);
    const result = store.addUnits(parsed.title, raw, parsed.units);
    added += result.added;
    skipped += result.skipped;
    syllabusId = result.syllabusId;
  }

  if (kept.length > 0) {
    store.pruneSyllabi(kept);
  }

  return { syllabusId, added, skipped, files };
}
