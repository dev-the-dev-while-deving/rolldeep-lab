#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { getStore } from "@/lib/store";
import { getLab } from "@/lib/lab";
import { syncContent, writeUnitsFile, parseUnitsFile } from "@/lib/content";
import { RollDeepError } from "@/lib/errors";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function print(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(error instanceof RollDeepError ? 2 : 1);
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

function startLab(options: { open: boolean; port: string }): void {
  const host = "127.0.0.1";
  const url = `http://${host}:${options.port}`;
  const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
  process.stderr.write(`ROLLDEEP lab · ${url}\n`);
  if (options.open) {
    setTimeout(() => openBrowser(url), 1800);
  }
  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", host, "--port", options.port], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

function startMcp(): void {
  const tsx = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const server = path.join(repoRoot, "mcp", "server.ts");
  const child = spawn(process.execPath, [tsx, server], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

const program = new Command();
program
  .name("rolldeep")
  .description("Local learning lab + AI harness. Same command for humans and models.")
  .showHelpAfterError();

program
  .command("lab", { isDefault: true })
  .alias("notebook")
  .alias("start")
  .description("Start the local lab in the browser (like jupyter lab)")
  .option("--port <port>", "Port", "3210")
  .option("--no-open", "Do not open a browser tab")
  .action((opts: { port: string; open: boolean }) => {
    startLab(opts);
  });

program
  .command("mcp")
  .description("Start the MCP stdio server for any AI client")
  .action(() => {
    startMcp();
  });

program
  .command("status")
  .description("Streak, pool counts, and the active topic")
  .action(() => {
    try {
      print(getLab().status());
    } catch (error) {
      fail(error);
    }
  });

program
  .command("roll")
  .description("Draw exactly one unused topic")
  .action(() => {
    try {
      print(getLab().roll());
    } catch (error) {
      fail(error);
    }
  });

program
  .command("choose")
  .description("Lock in a visible session roll")
  .requiredOption("--id <id>", "Topic id from status (current or previous)")
  .action((opts: { id: string }) => {
    try {
      print(getLab().choose(opts.id));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("reset")
  .description("Wipe runtime state and resync content/units")
  .action(() => {
    try {
      const store = getStore();
      store.wipe();
      print(syncContent(store));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("complete")
  .description("Mark the active topic completed")
  .requiredOption("--id <id>", "Topic id (from status or roll)")
  .option("--notes <text>", "Free-form notes")
  .requiredOption("--url <url>", "Proof video URL")
  .action((opts: { id: string; notes?: string; url?: string }) => {
    try {
      print(getLab().complete(opts.id, { notes: opts.notes, videoUrl: opts.url }));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("library")
  .description("List completed topics")
  .option("--search <query>", "Filter title, question, or notes")
  .action((opts: { search?: string }) => {
    try {
      print(getLab().library(opts.search));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("pool")
  .description("List available (unrolled) topics")
  .option("--search <query>", "Filter title or question")
  .action((opts: { search?: string }) => {
    try {
      print(getLab().pool(opts.search));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("delete")
  .description("Delete an available topic")
  .argument("<id>", "Topic id")
  .action((id: string) => {
    try {
      getLab().deleteAvailable(id);
      print({ deleted: id });
    } catch (error) {
      fail(error);
    }
  });

program
  .command("sync")
  .description("Pull content/units/*.json into the local pool")
  .action(() => {
    try {
      print(syncContent(getStore()));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("syllabi")
  .description("List syllabi and per-course completion")
  .action(() => {
    try {
      print(getLab().status().syllabi);
    } catch (error) {
      fail(error);
    }
  });

program
  .command("use")
  .description("Switch the active syllabus (rolls and completion stay per course)")
  .option("--id <id>", "Syllabus id")
  .option("--title <title>", "Syllabus title")
  .action((opts: { id?: string; title?: string }) => {
    try {
      const lab = getLab();
      let id = opts.id;
      if (!id && opts.title) {
        const match = lab
          .syllabi()
          .find((row) => row.title.toLowerCase() === opts.title!.trim().toLowerCase());
        if (!match) fail(new Error(`Unknown syllabus title: ${opts.title}`));
        id = match.id;
      }
      if (!id) fail(new Error("Pass --id or --title"));
      print(lab.setActiveSyllabus(id));
    } catch (error) {
      fail(error);
    }
  });

program
  .command("add-units")
  .description("Write a units JSON file into content/units and sync")
  .requiredOption("--file <path>", "JSON array or { title, units }")
  .option("--title <title>", "Syllabus title")
  .action((opts: { file: string; title?: string }) => {
    try {
      const raw = fs.readFileSync(path.resolve(opts.file), "utf8");
      const parsed = parseUnitsFile(raw, opts.title ?? path.basename(opts.file, ".json"));
      const written = writeUnitsFile({
        title: opts.title ?? parsed.title,
        units: parsed.units,
      });
      const synced = syncContent(getStore());
      print({ written, ...synced });
    } catch (error) {
      fail(error);
    }
  });

program.parseAsync(process.argv).catch(fail);
