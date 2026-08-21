#!/usr/bin/env npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { getLab } from "@/lib/lab";
import { syncContent, writeUnitsFile } from "@/lib/content";
import type { NewUnit } from "@/lib/types";

function ok(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: data as Record<string, unknown>,
  };
}

function fail(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${text}` }],
    isError: true as const,
  };
}

const server = new McpServer({
  name: "rolldeep-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "rolldeep_status",
  {
    title: "RollDeep status",
    description:
      "Read the local RollDeep lab: streak, available/completed counts, and the in-progress topic if any. Data lives on this machine in ~/.rolldeep (or ROLLDEEP_HOME).",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      return ok(getLab().status());
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_roll",
  {
    title: "Roll one topic",
    description:
      "Draw exactly one unused topic into the session tray. Up to 5 rolls per session. Only the current roll plus 3 previous stay visible. Fails if a chosen topic is already in progress, the session is out of rerolls, or the pool is empty.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async () => {
    try {
      return ok(getLab().roll());
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_choose",
  {
    title: "Choose a visible roll",
    description:
      "Lock in the current roll or one of the up to 3 previous visible rolls. Other session rolls return to the pool. Required before completing. Max 5 rolls per session.",
    inputSchema: {
      id: z.string().describe("Topic id from rolldeep_status current or previous"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ id }) => {
    try {
      return ok(getLab().choose(id));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_complete",
  {
    title: "Complete active topic",
    description:
      "Mark the in-progress topic completed. Permanently excludes it from future rolls. video_url is the proof you actually did it.",
    inputSchema: {
      id: z.string().describe("Topic id from rolldeep_status or rolldeep_roll"),
      video_url: z.string().describe("Proof: a link to the video you made"),
      notes: z.string().optional().describe("Free-form notes"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ id, notes, video_url }) => {
    try {
      return ok(getLab().complete(id, { notes, videoUrl: video_url }));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_library",
  {
    title: "Search completed topics",
    description: "List completed topics from the local library. Optional search across title, question, and notes.",
    inputSchema: {
      search: z.string().optional().describe("Filter text"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ search }) => {
    try {
      return ok(getLab().library(search));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_pool",
  {
    title: "List available topics",
    description:
      "List unused topics still in the pool. For setup/debug only — never offer these as a multiple-choice roll.",
    inputSchema: {
      search: z.string().optional().describe("Filter text"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ search }) => {
    try {
      return ok(getLab().pool(search));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_add_units",
  {
    title: "Add units (agent-authored)",
    description:
      "Write agent-authored units into content/units/*.json and sync them into the local pool. Prefer editing those JSON files directly in the repo, then call rolldeep_sync.",
    inputSchema: {
      title: z.string().describe("Syllabus label"),
      units: z
        .array(
          z.object({
            title: z.string(),
            question: z.string(),
            minutes: z.number(),
            sourceExcerpt: z.string().optional(),
          }),
        )
        .describe("Units to add"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ title, units }) => {
    try {
      const payload = units as NewUnit[];
      const written = writeUnitsFile({ title, units: payload });
      const synced = syncContent(getStore());
      return ok({ written, ...synced });
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_syllabi",
  {
    title: "List syllabi",
    description:
      "List every syllabus in the local lab with unit counts and per-course completion. Each content/units/*.json file is one syllabus.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      return ok(getLab().status().syllabi);
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_use",
  {
    title: "Switch active syllabus",
    description:
      "Set the active syllabus. Rolls, the session tray, the pool, and completions are per syllabus and do not mix. Pass id or title.",
    inputSchema: {
      id: z.string().optional().describe("Syllabus id from rolldeep_syllabi"),
      title: z.string().optional().describe("Syllabus title (case-insensitive)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, title }) => {
    try {
      const lab = getLab();
      let syllabusId = id;
      if (!syllabusId && title) {
        const match = lab.syllabi().find((row) => row.title.toLowerCase() === title.trim().toLowerCase());
        if (!match) return fail(new Error(`Unknown syllabus title: ${title}`));
        syllabusId = match.id;
      }
      if (!syllabusId) return fail(new Error("Pass id or title"));
      return ok(lab.setActiveSyllabus(syllabusId));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_sync",
  {
    title: "Sync content files",
    description:
      "Read content/units/*.json from the repo and insert any new titles into the local pool. Completed topics are never resurrected. After you edit unit files, call this (or just load the Lab).",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      return ok(syncContent(getStore()));
    } catch (error) {
      return fail(error);
    }
  },
);

server.registerTool(
  "rolldeep_delete_available",
  {
    title: "Delete unused topic",
    description: "Delete an available (never rolled) topic. Completed topics cannot be deleted.",
    inputSchema: {
      id: z.string().describe("Topic id"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    try {
      getLab().deleteAvailable(id);
      return ok({ deleted: id });
    } catch (error) {
      return fail(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("rolldeep-mcp-server ready (stdio)\n");
