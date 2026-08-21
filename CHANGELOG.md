# Changelog

## 1.1.0 — 2026-08-21

Multiple courses, one lab. Progress stays on the course you picked.

### Added
- Syllabus dropdown in the header. Switch courses without mixing rolls, the pool, or completions.
- Sticky progress bar in the top right (`done / total` for the active syllabus).
- Neo-brutalist custom syllabus menu (no native OS select).
- SETUP lists every course with its own `done / total`.
- CLI: `rolldeep syllabi`, `rolldeep use --title "..."` / `--id`.
- MCP: `rolldeep_syllabi`, `rolldeep_use`.

### Changed
- Each `content/units/*.json` file is one syllabus.
- Duplicate titles only skip inside the same syllabus. Two courses can both have “Trees”.
- Re-syncing the same course updates it instead of cloning a new empty syllabus.
- Sync drops leftover syllabi that no longer have a units file.

### Fixed
- Old page-load syncs that created many empty copies of the same course.
