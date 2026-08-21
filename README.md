# ROLLDEEP

A private **local** learning lab and an **AI harness**.

The human hits ROLL in the browser. Any model operates the same store through files, CLI, or MCP.

One command, like Jupyter:

```bash
rolldeep
```

That starts the lab on [http://127.0.0.1:3210](http://127.0.0.1:3210). Aliases: `rolldeep lab`, `rolldeep notebook`.

## Install

```bash
git clone https://github.com/dev-the-dev-while-deving/rolldeep-lab.git
cd rolldeep-lab
npm install
npm rebuild better-sqlite3
npm link
rolldeep
```

Without a global link:

```bash
npx rolldeep
```

Runtime data: `~/.rolldeep/` (override with `ROLLDEEP_HOME`).
The topic pool is files in this repo: `content/units/*.json`.

## Humans

1. `rolldeep`
2. ROLL (up to 5 times a session). Current card plus 3 previous stay visible. TAKE one.
3. Study however you want. Make a video so you actually did it.
4. Mark completed with that proof. That topic never comes back.

Hardness is 1–5 stars. Each card is **topic**, then **question**.

Drop a syllabus in `content/syllabi/` if you want more units. The agent writes `content/units/`.

## Any AI model

Same lab. Three ways in, all first-class:

| Path | How |
|---|---|
| Files | Edit `content/units/*.json`, then `rolldeep sync` |
| CLI | `rolldeep status` / `roll` / `choose` / `complete` |
| MCP | `rolldeep mcp` — or add the server from `.mcp.json` |

Grok:

```bash
grok mcp add rolldeep -- npx tsx mcp/server.ts
```

Claude Code / Cursor: this repo already has `.mcp.json`.

Read `SKILL.md` and `AGENTS.md` for the contract.

```bash
rolldeep status
rolldeep roll
rolldeep choose --id <id>
rolldeep complete --id <id> --url https://...
rolldeep sync
```

Do not mint dummy “What is X?” questions. Author units into the JSON files.

## Rules

- Up to 5 rolls per session; only the current plus 3 previous stay visible
- TAKE one, then finish with proof
- Completed topics are excluded forever
- Topic name and curiosity question are both shown
- No study how-to in the UI

## License

MIT
