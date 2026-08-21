import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultHomeDir(): string {
  return process.env.ROLLDEEP_HOME?.trim() || path.join(os.homedir(), ".rolldeep");
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPathFor(homeDir: string): string {
  return path.join(homeDir, "rolldeep.db");
}

export function filesDirFor(homeDir: string): string {
  return path.join(homeDir, "files");
}
