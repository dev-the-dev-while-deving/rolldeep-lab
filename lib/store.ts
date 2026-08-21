import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  ActiveTopicError,
  CannotDeleteError,
  EmptyPoolError,
  MissingProofError,
  NotVisibleError,
  SessionRollLimitError,
  TopicNotActiveError,
} from "@/lib/errors";
import { dbPathFor, defaultHomeDir, ensureDir, filesDirFor } from "@/lib/paths";
import { MAX_PREVIOUS_VISIBLE, MAX_SESSION_ROLLS } from "@/lib/session-rules";
import { nextStreak, todayInTz } from "@/lib/streak";
import type { AddUnitsResult, CompleteInput, LabStatus, NewUnit, Topic } from "@/lib/types";

export type StoreOptions = {
  homeDir?: string;
  now?: () => Date;
  timezone?: string;
};

type TopicRow = {
  id: string;
  syllabus_id: string | null;
  title: string;
  question: string;
  minutes: number;
  stars: number;
  source_excerpt: string | null;
  status: Topic["status"];
  rolled_at: number | null;
  completed_at: number | null;
  video_url: string | null;
  notes: string | null;
  created_at: number;
};

const TOPIC_COLS = `id, syllabus_id, title, question, minutes, stars, source_excerpt, status,
            rolled_at, completed_at, video_url, notes, created_at`;

const MIGRATE = `
CREATE TABLE IF NOT EXISTS syllabi (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  syllabus_id TEXT,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  stars INTEGER NOT NULL DEFAULT 3,
  source_excerpt TEXT,
  status TEXT NOT NULL,
  rolled_at INTEGER,
  completed_at INTEGER,
  video_url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(id)
);

CREATE INDEX IF NOT EXISTS topics_status ON topics(status);
CREATE UNIQUE INDEX IF NOT EXISTS topics_one_in_progress
  ON topics(status) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak INTEGER NOT NULL,
  last_roll_date TEXT,
  timezone TEXT NOT NULL,
  session_rolls INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_draw (
  topic_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  visible INTEGER NOT NULL
);
`;

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 40;
  return Math.min(60, Math.max(25, Math.round(value)));
}

function clampStars(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value as number)));
}

function mapTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    syllabusId: row.syllabus_id,
    title: row.title,
    question: row.question,
    minutes: row.minutes,
    stars: row.stars,
    sourceExcerpt: row.source_excerpt,
    status: row.status,
    rolledAt: row.rolled_at,
    completedAt: row.completed_at,
    videoUrl: row.video_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function ensureColumn(
  sqlite: InstanceType<typeof Database>,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = sqlite.pragma(`table_info(${table})`) as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function createStore(options: StoreOptions = {}) {
  const homeDir = ensureDir(options.homeDir ?? defaultHomeDir());
  ensureDir(filesDirFor(homeDir));
  const sqlite = new Database(dbPathFor(homeDir));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATE);
  ensureColumn(sqlite, "topics", "stars", "INTEGER NOT NULL DEFAULT 3");
  ensureColumn(sqlite, "stats", "session_rolls", "INTEGER NOT NULL DEFAULT 0");

  const now = options.now ?? (() => new Date());
  const defaultTimezone =
    options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  sqlite
    .prepare(
      `INSERT OR IGNORE INTO stats (id, current_streak, last_roll_date, timezone, session_rolls)
       VALUES (1, 0, NULL, ?, 0)`,
    )
    .run(defaultTimezone);

  if (options.timezone) {
    sqlite.prepare(`UPDATE stats SET timezone = ? WHERE id = 1`).run(options.timezone);
  }

  const selectTopic = sqlite.prepare(`SELECT ${TOPIC_COLS} FROM topics WHERE id = ?`);

  const selectActive = sqlite.prepare(
    `SELECT ${TOPIC_COLS} FROM topics WHERE status = 'in_progress' LIMIT 1`,
  );

  function active(): Topic | null {
    const row = selectActive.get() as TopicRow | undefined;
    return row ? mapTopic(row) : null;
  }

  function statsRow() {
    return sqlite
      .prepare(
        `SELECT current_streak, last_roll_date, timezone, session_rolls FROM stats WHERE id = 1`,
      )
      .get() as {
      current_streak: number;
      last_roll_date: string | null;
      timezone: string;
      session_rolls: number;
    };
  }

  function count(status?: Topic["status"]): number {
    if (!status) {
      return (sqlite.prepare(`SELECT COUNT(*) AS n FROM topics`).get() as { n: number }).n;
    }
    return (
      sqlite.prepare(`SELECT COUNT(*) AS n FROM topics WHERE status = ?`).get(status) as { n: number }
    ).n;
  }

  function getTopic(id: string): Topic | null {
    const row = selectTopic.get(id) as TopicRow | undefined;
    return row ? mapTopic(row) : null;
  }

  function visibleDraws(): { topic_id: string; seq: number }[] {
    return sqlite
      .prepare(`SELECT topic_id, seq FROM session_draw WHERE visible = 1 ORDER BY seq DESC`)
      .all() as { topic_id: string; seq: number }[];
  }

  function addUnits(title: string, rawText: string, units: NewUnit[]): AddUnitsResult {
    const syllabusId = randomUUID();
    const createdAt = now().getTime();
    const insertSyllabus = sqlite.transaction(() => {
      sqlite
        .prepare(
          `INSERT INTO syllabi (id, title, raw_text, status, error, created_at)
           VALUES (?, ?, ?, 'ready', NULL, ?)`,
        )
        .run(syllabusId, title.trim() || "Untitled syllabus", rawText, createdAt);

      const existing = new Set(
        (sqlite.prepare(`SELECT title FROM topics`).all() as { title: string }[]).map((row) =>
          row.title.toLowerCase(),
        ),
      );

      let added = 0;
      let skipped = 0;
      const insert = sqlite.prepare(
        `INSERT INTO topics (
           id, syllabus_id, title, question, minutes, stars, source_excerpt,
           status, rolled_at, completed_at, video_url, notes, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', NULL, NULL, NULL, NULL, ?)`,
      );

      for (const unit of units) {
        const unitTitle = unit.title.trim();
        if (!unitTitle) {
          skipped += 1;
          continue;
        }
        const key = unitTitle.toLowerCase();
        if (existing.has(key)) {
          skipped += 1;
          continue;
        }
        existing.add(key);
        insert.run(
          randomUUID(),
          syllabusId,
          unitTitle,
          unit.question.trim(),
          clampMinutes(unit.minutes),
          clampStars(unit.stars),
          unit.sourceExcerpt?.trim() || null,
          createdAt,
        );
        added += 1;
      }

      return { added, skipped };
    });

    const { added, skipped } = insertSyllabus();
    return { syllabusId, added, skipped };
  }

  function roll(): Topic {
    const run = sqlite.transaction(() => {
      if (active()) throw new ActiveTopicError();
      const stats = statsRow();
      if (stats.session_rolls >= MAX_SESSION_ROLLS) throw new SessionRollLimitError();

      const picked = sqlite
        .prepare(
          `SELECT ${TOPIC_COLS} FROM topics
           WHERE status = 'available'
             AND id NOT IN (SELECT topic_id FROM session_draw)
           ORDER BY RANDOM() LIMIT 1`,
        )
        .get() as TopicRow | undefined;
      if (!picked) throw new EmptyPoolError();

      const rolledAt = now().getTime();
      sqlite
        .prepare(`UPDATE topics SET status = 'rolled', rolled_at = ? WHERE id = ?`)
        .run(rolledAt, picked.id);

      const nextSeq =
        (
          sqlite.prepare(`SELECT COALESCE(MAX(seq), 0) AS n FROM session_draw`).get() as { n: number }
        ).n + 1;
      sqlite
        .prepare(`INSERT INTO session_draw (topic_id, seq, visible) VALUES (?, ?, 1)`)
        .run(picked.id, nextSeq);

      const visible = visibleDraws();
      const maxVisible = 1 + MAX_PREVIOUS_VISIBLE;
      if (visible.length > maxVisible) {
        const oldest = sqlite
          .prepare(`SELECT topic_id FROM session_draw WHERE visible = 1 ORDER BY seq ASC LIMIT 1`)
          .get() as { topic_id: string };
        sqlite.prepare(`UPDATE session_draw SET visible = 0 WHERE topic_id = ?`).run(oldest.topic_id);
        sqlite
          .prepare(`UPDATE topics SET status = 'available', rolled_at = NULL WHERE id = ?`)
          .run(oldest.topic_id);
      }

      sqlite.prepare(`UPDATE stats SET session_rolls = session_rolls + 1 WHERE id = 1`).run();

      const today = todayInTz(stats.timezone, now());
      const streak = nextStreak(stats.current_streak, stats.last_roll_date, today);
      sqlite
        .prepare(`UPDATE stats SET current_streak = ?, last_roll_date = ? WHERE id = 1`)
        .run(streak.currentStreak, streak.lastRollDate);

      const row = selectTopic.get(picked.id) as TopicRow | undefined;
      if (!row) throw new EmptyPoolError();
      return mapTopic(row);
    });
    return run();
  }

  function choose(id: string): Topic {
    const run = sqlite.transaction(() => {
      if (active()) throw new ActiveTopicError();
      const visible = visibleDraws();
      if (!visible.some((row) => row.topic_id === id)) throw new NotVisibleError();

      const draws = sqlite.prepare(`SELECT topic_id FROM session_draw`).all() as { topic_id: string }[];
      for (const draw of draws) {
        if (draw.topic_id === id) continue;
        sqlite
          .prepare(`UPDATE topics SET status = 'available', rolled_at = NULL WHERE id = ?`)
          .run(draw.topic_id);
      }
      sqlite.prepare(`DELETE FROM session_draw`).run();
      sqlite.prepare(`UPDATE stats SET session_rolls = 0 WHERE id = 1`).run();
      sqlite
        .prepare(`UPDATE topics SET status = 'in_progress' WHERE id = ?`)
        .run(id);

      const row = selectTopic.get(id) as TopicRow | undefined;
      if (!row) throw new NotVisibleError();
      return mapTopic(row);
    });
    return run();
  }

  function complete(id: string, input: CompleteInput = {}): Topic {
    const run = sqlite.transaction(() => {
      const current = active();
      if (!current || current.id !== id) throw new TopicNotActiveError();
      if (!input.videoUrl?.trim()) throw new MissingProofError();
      sqlite
        .prepare(
          `UPDATE topics
           SET status = 'completed', completed_at = ?, video_url = ?, notes = ?
           WHERE id = ?`,
        )
        .run(now().getTime(), input.videoUrl.trim(), input.notes?.trim() || null, id);
      sqlite.prepare(`DELETE FROM session_draw`).run();
      sqlite.prepare(`UPDATE stats SET session_rolls = 0 WHERE id = 1`).run();
      const row = selectTopic.get(id) as TopicRow | undefined;
      if (!row) throw new TopicNotActiveError();
      return mapTopic(row);
    });
    return run();
  }

  function library(query?: string): Topic[] {
    const q = query?.trim();
    const like = q ? `%${q.toLowerCase()}%` : null;
    const rows = (
      like
        ? sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'completed'
                 AND (
                   lower(title) LIKE ? OR lower(question) LIKE ? OR lower(coalesce(notes, '')) LIKE ?
                 )
               ORDER BY completed_at DESC`,
            )
            .all(like, like, like)
        : sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics WHERE status = 'completed'
               ORDER BY completed_at DESC`,
            )
            .all()
    ) as TopicRow[];
    return rows.map(mapTopic);
  }

  function pool(query?: string): Topic[] {
    const q = query?.trim();
    const like = q ? `%${q.toLowerCase()}%` : null;
    const rows = (
      like
        ? sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'available'
                 AND (lower(title) LIKE ? OR lower(question) LIKE ?)
               ORDER BY created_at DESC`,
            )
            .all(like, like)
        : sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics WHERE status = 'available'
               ORDER BY created_at DESC`,
            )
            .all()
    ) as TopicRow[];
    return rows.map(mapTopic);
  }

  function deleteAvailable(id: string): void {
    const topic = getTopic(id);
    if (!topic || topic.status !== "available") throw new CannotDeleteError();
    sqlite.prepare(`DELETE FROM topics WHERE id = ?`).run(id);
  }

  function setTimezone(timezone: string): void {
    sqlite.prepare(`UPDATE stats SET timezone = ? WHERE id = 1`).run(timezone);
  }

  function saveFile(originalName: string, data: Uint8Array): string {
    const safe = path.basename(originalName).replace(/[^\w.\-]+/g, "_") || "upload.bin";
    const filename = `${randomUUID()}-${safe}`;
    fs.writeFileSync(path.join(filesDirFor(homeDir), filename), data);
    return filename;
  }

  function shoppingWindow(): { current: Topic | null; previous: Topic[] } {
    const visible = visibleDraws();
    if (visible.length === 0) return { current: null, previous: [] };
    const topics = visible
      .map((row) => getTopic(row.topic_id))
      .filter((topic): topic is Topic => Boolean(topic));
    return { current: topics[0] ?? null, previous: topics.slice(1, 1 + MAX_PREVIOUS_VISIBLE) };
  }

  function status(): LabStatus {
    const stats = statsRow();
    const window = shoppingWindow();
    return {
      available: count("available"),
      completed: count("completed"),
      currentStreak: stats.current_streak,
      lastRollDate: stats.last_roll_date,
      timezone: stats.timezone,
      inProgress: active(),
      current: active() ? null : window.current,
      previous: active() ? [] : window.previous,
      rollsUsed: stats.session_rolls,
      rollsLeft: Math.max(0, MAX_SESSION_ROLLS - stats.session_rolls),
      homeDir,
    };
  }

  function syllabi() {
    return sqlite
      .prepare(
        `SELECT s.id, s.title, s.status, s.error, s.created_at,
                (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id) AS unit_count
         FROM syllabi s
         ORDER BY s.created_at DESC`,
      )
      .all() as {
      id: string;
      title: string;
      status: string;
      error: string | null;
      created_at: number;
      unit_count: number;
    }[];
  }

  function wipe(): void {
    sqlite.exec(`
      DELETE FROM session_draw;
      DELETE FROM topics;
      DELETE FROM syllabi;
      UPDATE stats SET current_streak = 0, last_roll_date = NULL, session_rolls = 0 WHERE id = 1;
    `);
  }

  function close(): void {
    sqlite.close();
  }

  return {
    homeDir,
    addUnits,
    roll,
    choose,
    complete,
    library,
    pool,
    deleteAvailable,
    status,
    syllabi,
    getTopic,
    setTimezone,
    saveFile,
    wipe,
    close,
  };
}

export type Store = ReturnType<typeof createStore>;

const globalForStore = globalThis as { __rolldeepStore?: Store };

export function resetStoreSingleton(): void {
  globalForStore.__rolldeepStore?.close();
  globalForStore.__rolldeepStore = undefined;
}

export function getStore(): Store {
  if (!globalForStore.__rolldeepStore) {
    globalForStore.__rolldeepStore = createStore();
  }
  return globalForStore.__rolldeepStore;
}
