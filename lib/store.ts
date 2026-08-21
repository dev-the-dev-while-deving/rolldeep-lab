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
  UnknownSyllabusError,
} from "@/lib/errors";
import { dbPathFor, defaultHomeDir, ensureDir, filesDirFor } from "@/lib/paths";
import { MAX_PREVIOUS_VISIBLE, MAX_SESSION_ROLLS } from "@/lib/session-rules";
import { nextStreak, todayInTz } from "@/lib/streak";
import type { AddUnitsResult, CompleteInput, LabStatus, NewUnit, SyllabusRecord, Topic } from "@/lib/types";

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
  ensureColumn(sqlite, "stats", "active_syllabus_id", "TEXT");
  ensureColumn(sqlite, "syllabi", "session_rolls", "INTEGER NOT NULL DEFAULT 0");
  sqlite.exec(`DROP INDEX IF EXISTS topics_one_in_progress`);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS topics_one_in_progress_per_syllabus
    ON topics(syllabus_id) WHERE status = 'in_progress'
  `);

  function collapseDuplicateSyllabi(): void {
    const dupes = sqlite
      .prepare(
        `SELECT lower(title) AS key FROM syllabi GROUP BY lower(title) HAVING COUNT(*) > 1`,
      )
      .all() as { key: string }[];
    for (const { key } of dupes) {
      const rows = sqlite
        .prepare(
          `SELECT s.id,
                  (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id) AS n
           FROM syllabi s
           WHERE lower(s.title) = ?
           ORDER BY n DESC, s.created_at ASC`,
        )
        .all(key) as { id: string; n: number }[];
      const keeper = rows[0];
      if (!keeper) continue;
      for (const extra of rows.slice(1)) {
        sqlite
          .prepare(
            `UPDATE topics SET status = 'available', rolled_at = NULL
             WHERE syllabus_id = ? AND status = 'in_progress'`,
          )
          .run(extra.id);
        sqlite.prepare(`UPDATE topics SET syllabus_id = ? WHERE syllabus_id = ?`).run(keeper.id, extra.id);
        sqlite.prepare(`DELETE FROM syllabi WHERE id = ?`).run(extra.id);
      }
      sqlite
        .prepare(
          `UPDATE stats SET active_syllabus_id = ? WHERE active_syllabus_id IN (${rows
            .slice(1)
            .map(() => "?")
            .join(",")})`,
        )
        .run(keeper.id, ...rows.slice(1).map((row) => row.id));
    }
  }

  collapseDuplicateSyllabi();

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

  function statsRow() {
    return sqlite
      .prepare(
        `SELECT current_streak, last_roll_date, timezone, session_rolls, active_syllabus_id
         FROM stats WHERE id = 1`,
      )
      .get() as {
      current_streak: number;
      last_roll_date: string | null;
      timezone: string;
      session_rolls: number;
      active_syllabus_id: string | null;
    };
  }

  function currentSyllabusId(): string | null {
    const stats = statsRow();
    if (stats.active_syllabus_id) {
      const exists = sqlite
        .prepare(`SELECT id FROM syllabi WHERE id = ?`)
        .get(stats.active_syllabus_id) as { id: string } | undefined;
      if (exists) return exists.id;
    }
    const fallback = sqlite
      .prepare(`SELECT id FROM syllabi ORDER BY created_at DESC LIMIT 1`)
      .get() as { id: string } | undefined;
    if (fallback) {
      sqlite.prepare(`UPDATE stats SET active_syllabus_id = ? WHERE id = 1`).run(fallback.id);
      return fallback.id;
    }
    return null;
  }

  function syllabusSessionRolls(syllabusId: string): number {
    const row = sqlite
      .prepare(`SELECT session_rolls FROM syllabi WHERE id = ?`)
      .get(syllabusId) as { session_rolls: number } | undefined;
    return row?.session_rolls ?? 0;
  }

  function active(): Topic | null {
    const syllabusId = currentSyllabusId();
    if (!syllabusId) return null;
    const row = sqlite
      .prepare(
        `SELECT ${TOPIC_COLS} FROM topics WHERE status = 'in_progress' AND syllabus_id = ? LIMIT 1`,
      )
      .get(syllabusId) as TopicRow | undefined;
    return row ? mapTopic(row) : null;
  }

  function count(status?: Topic["status"]): number {
    const syllabusId = currentSyllabusId();
    if (!syllabusId) return 0;
    if (!status) {
      return (
        sqlite.prepare(`SELECT COUNT(*) AS n FROM topics WHERE syllabus_id = ?`).get(syllabusId) as {
          n: number;
        }
      ).n;
    }
    return (
      sqlite
        .prepare(`SELECT COUNT(*) AS n FROM topics WHERE status = ? AND syllabus_id = ?`)
        .get(status, syllabusId) as { n: number }
    ).n;
  }

  function getTopic(id: string): Topic | null {
    const row = selectTopic.get(id) as TopicRow | undefined;
    return row ? mapTopic(row) : null;
  }

  function visibleDraws(syllabusId: string): { topic_id: string; seq: number }[] {
    return sqlite
      .prepare(
        `SELECT sd.topic_id, sd.seq
         FROM session_draw sd
         JOIN topics t ON t.id = sd.topic_id
         WHERE sd.visible = 1 AND t.syllabus_id = ?
         ORDER BY sd.seq DESC`,
      )
      .all(syllabusId) as { topic_id: string; seq: number }[];
  }

  function clearSyllabusSession(syllabusId: string): void {
    sqlite
      .prepare(
        `DELETE FROM session_draw
         WHERE topic_id IN (SELECT id FROM topics WHERE syllabus_id = ?)`,
      )
      .run(syllabusId);
    sqlite.prepare(`UPDATE syllabi SET session_rolls = 0 WHERE id = ?`).run(syllabusId);
  }

  function addUnits(title: string, rawText: string, units: NewUnit[]): AddUnitsResult {
    const trimmed = title.trim() || "Untitled syllabus";
    const createdAt = now().getTime();
    const insertSyllabus = sqlite.transaction(() => {
      const existingRow = sqlite
        .prepare(
          `SELECT s.id
           FROM syllabi s
           WHERE lower(s.title) = lower(?)
           ORDER BY (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id) DESC,
                    s.created_at ASC
           LIMIT 1`,
        )
        .get(trimmed) as { id: string } | undefined;
      const syllabusId = existingRow?.id ?? randomUUID();
      if (existingRow) {
        sqlite
          .prepare(`UPDATE syllabi SET raw_text = ?, status = 'ready', error = NULL WHERE id = ?`)
          .run(rawText, syllabusId);
      } else {
        sqlite
          .prepare(
            `INSERT INTO syllabi (id, title, raw_text, status, error, created_at, session_rolls)
             VALUES (?, ?, ?, 'ready', NULL, ?, 0)`,
          )
          .run(syllabusId, trimmed, rawText, createdAt);
      }

      const existing = new Set(
        (
          sqlite.prepare(`SELECT title FROM topics WHERE syllabus_id = ?`).all(syllabusId) as {
            title: string;
          }[]
        ).map((row) => row.title.toLowerCase()),
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

      if (!statsRow().active_syllabus_id) {
        sqlite.prepare(`UPDATE stats SET active_syllabus_id = ? WHERE id = 1`).run(syllabusId);
      }

      return { added, skipped, syllabusId };
    });

    return insertSyllabus();
  }

  function roll(): Topic {
    const run = sqlite.transaction(() => {
      const syllabusId = currentSyllabusId();
      if (!syllabusId) throw new EmptyPoolError();
      if (active()) throw new ActiveTopicError();
      const stats = statsRow();
      if (syllabusSessionRolls(syllabusId) >= MAX_SESSION_ROLLS) throw new SessionRollLimitError();

      const picked = sqlite
        .prepare(
          `SELECT ${TOPIC_COLS} FROM topics
           WHERE status = 'available'
             AND syllabus_id = ?
             AND id NOT IN (
               SELECT sd.topic_id FROM session_draw sd
               JOIN topics t ON t.id = sd.topic_id
               WHERE t.syllabus_id = ?
             )
           ORDER BY RANDOM() LIMIT 1`,
        )
        .get(syllabusId, syllabusId) as TopicRow | undefined;
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

      const visible = visibleDraws(syllabusId);
      const maxVisible = 1 + MAX_PREVIOUS_VISIBLE;
      if (visible.length > maxVisible) {
        const oldest = sqlite
          .prepare(
            `SELECT sd.topic_id FROM session_draw sd
             JOIN topics t ON t.id = sd.topic_id
             WHERE sd.visible = 1 AND t.syllabus_id = ?
             ORDER BY sd.seq ASC LIMIT 1`,
          )
          .get(syllabusId) as { topic_id: string };
        sqlite.prepare(`UPDATE session_draw SET visible = 0 WHERE topic_id = ?`).run(oldest.topic_id);
        sqlite
          .prepare(`UPDATE topics SET status = 'available', rolled_at = NULL WHERE id = ?`)
          .run(oldest.topic_id);
      }

      sqlite
        .prepare(`UPDATE syllabi SET session_rolls = session_rolls + 1 WHERE id = ?`)
        .run(syllabusId);

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
      const syllabusId = currentSyllabusId();
      if (!syllabusId) throw new NotVisibleError();
      if (active()) throw new ActiveTopicError();
      const visible = visibleDraws(syllabusId);
      if (!visible.some((row) => row.topic_id === id)) throw new NotVisibleError();

      const draws = sqlite
        .prepare(
          `SELECT sd.topic_id FROM session_draw sd
           JOIN topics t ON t.id = sd.topic_id
           WHERE t.syllabus_id = ?`,
        )
        .all(syllabusId) as { topic_id: string }[];
      for (const draw of draws) {
        if (draw.topic_id === id) continue;
        sqlite
          .prepare(`UPDATE topics SET status = 'available', rolled_at = NULL WHERE id = ?`)
          .run(draw.topic_id);
      }
      clearSyllabusSession(syllabusId);
      sqlite.prepare(`UPDATE topics SET status = 'in_progress' WHERE id = ?`).run(id);

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
      if (current.syllabusId) clearSyllabusSession(current.syllabusId);
      const row = selectTopic.get(id) as TopicRow | undefined;
      if (!row) throw new TopicNotActiveError();
      return mapTopic(row);
    });
    return run();
  }

  function library(query?: string): Topic[] {
    const syllabusId = currentSyllabusId();
    if (!syllabusId) return [];
    const q = query?.trim();
    const like = q ? `%${q.toLowerCase()}%` : null;
    const rows = (
      like
        ? sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'completed' AND syllabus_id = ?
                 AND (
                   lower(title) LIKE ? OR lower(question) LIKE ? OR lower(coalesce(notes, '')) LIKE ?
                 )
               ORDER BY completed_at DESC`,
            )
            .all(syllabusId, like, like, like)
        : sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'completed' AND syllabus_id = ?
               ORDER BY completed_at DESC`,
            )
            .all(syllabusId)
    ) as TopicRow[];
    return rows.map(mapTopic);
  }

  function pool(query?: string): Topic[] {
    const syllabusId = currentSyllabusId();
    if (!syllabusId) return [];
    const q = query?.trim();
    const like = q ? `%${q.toLowerCase()}%` : null;
    const rows = (
      like
        ? sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'available' AND syllabus_id = ?
                 AND (lower(title) LIKE ? OR lower(question) LIKE ?)
               ORDER BY created_at DESC`,
            )
            .all(syllabusId, like, like)
        : sqlite
            .prepare(
              `SELECT ${TOPIC_COLS} FROM topics
               WHERE status = 'available' AND syllabus_id = ?
               ORDER BY created_at DESC`,
            )
            .all(syllabusId)
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
    const syllabusId = currentSyllabusId();
    if (!syllabusId) return { current: null, previous: [] };
    const visible = visibleDraws(syllabusId);
    if (visible.length === 0) return { current: null, previous: [] };
    const topics = visible
      .map((row) => getTopic(row.topic_id))
      .filter((topic): topic is Topic => Boolean(topic));
    return { current: topics[0] ?? null, previous: topics.slice(1, 1 + MAX_PREVIOUS_VISIBLE) };
  }

  function syllabi(): SyllabusRecord[] {
    const rows = sqlite
      .prepare(
        `SELECT s.id, s.title, s.status, s.error, s.created_at,
                (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id) AS unit_count,
                (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id AND t.status = 'available') AS available,
                (SELECT COUNT(*) FROM topics t WHERE t.syllabus_id = s.id AND t.status = 'completed') AS completed
         FROM syllabi s
         ORDER BY s.created_at DESC`,
      )
      .all() as {
      id: string;
      title: string;
      status: SyllabusRecord["status"];
      error: string | null;
      created_at: number;
      unit_count: number;
      available: number;
      completed: number;
    }[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      unitCount: row.unit_count,
      available: row.available,
      completed: row.completed,
    }));
  }

  function setActiveSyllabus(id: string): SyllabusRecord {
    const row = sqlite
      .prepare(`SELECT id FROM syllabi WHERE id = ?`)
      .get(id) as { id: string } | undefined;
    if (!row) throw new UnknownSyllabusError();
    sqlite.prepare(`UPDATE stats SET active_syllabus_id = ? WHERE id = 1`).run(id);
    const catalog = syllabi();
    const record = catalog.find((item) => item.id === id);
    if (!record) throw new UnknownSyllabusError();
    return record;
  }

  function status(): LabStatus {
    const stats = statsRow();
    const window = shoppingWindow();
    const syllabusId = currentSyllabusId();
    const catalog = syllabi();
    const activeRecord = catalog.find((item) => item.id === syllabusId) ?? null;
    const rollsUsed = syllabusId ? syllabusSessionRolls(syllabusId) : 0;
    const inProgress = active();
    return {
      available: count("available"),
      completed: count("completed"),
      currentStreak: stats.current_streak,
      lastRollDate: stats.last_roll_date,
      timezone: stats.timezone,
      inProgress,
      current: inProgress ? null : window.current,
      previous: inProgress ? [] : window.previous,
      rollsUsed,
      rollsLeft: Math.max(0, MAX_SESSION_ROLLS - rollsUsed),
      homeDir,
      activeSyllabusId: syllabusId,
      activeSyllabusTitle: activeRecord?.title ?? null,
      syllabi: catalog,
    };
  }

  function deleteSyllabus(id: string): void {
    sqlite
      .prepare(
        `DELETE FROM session_draw
         WHERE topic_id IN (SELECT id FROM topics WHERE syllabus_id = ?)`,
      )
      .run(id);
    sqlite.prepare(`DELETE FROM topics WHERE syllabus_id = ?`).run(id);
    sqlite.prepare(`DELETE FROM syllabi WHERE id = ?`).run(id);
  }

  function pruneSyllabi(keepTitles: string[]): number {
    const keep = new Set(keepTitles.map((title) => title.trim().toLowerCase()).filter(Boolean));
    if (keep.size === 0) return 0;
    const rows = sqlite.prepare(`SELECT id, title FROM syllabi`).all() as { id: string; title: string }[];
    let removed = 0;
    for (const row of rows) {
      if (keep.has(row.title.toLowerCase())) continue;
      deleteSyllabus(row.id);
      removed += 1;
    }
    const activeId = statsRow().active_syllabus_id;
    if (activeId) {
      const still = sqlite.prepare(`SELECT id FROM syllabi WHERE id = ?`).get(activeId) as
        | { id: string }
        | undefined;
      if (!still) {
        const fallback = sqlite
          .prepare(`SELECT id FROM syllabi ORDER BY created_at DESC LIMIT 1`)
          .get() as { id: string } | undefined;
        sqlite
          .prepare(`UPDATE stats SET active_syllabus_id = ? WHERE id = 1`)
          .run(fallback?.id ?? null);
      }
    }
    return removed;
  }

  function wipe(): void {
    sqlite.exec(`
      DELETE FROM session_draw;
      DELETE FROM topics;
      DELETE FROM syllabi;
      UPDATE stats SET current_streak = 0, last_roll_date = NULL, session_rolls = 0, active_syllabus_id = NULL WHERE id = 1;
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
    setActiveSyllabus,
    pruneSyllabi,
    getTopic,
    setTimezone,
    saveFile,
    wipe,
    close,
  };
}

export type Store = ReturnType<typeof createStore>;

const STORE_REV = 2;

const globalForStore = globalThis as { __rolldeepStore?: Store; __rolldeepStoreRev?: number };

export function resetStoreSingleton(): void {
  globalForStore.__rolldeepStore?.close();
  globalForStore.__rolldeepStore = undefined;
}

export function getStore(): Store {
  if (globalForStore.__rolldeepStoreRev !== STORE_REV) {
    resetStoreSingleton();
    globalForStore.__rolldeepStoreRev = STORE_REV;
  }
  if (!globalForStore.__rolldeepStore) {
    globalForStore.__rolldeepStore = createStore();
  }
  return globalForStore.__rolldeepStore;
}
