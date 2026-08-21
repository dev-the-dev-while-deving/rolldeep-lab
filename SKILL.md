---
name: rolldeep
description: >
  Local learning lab and AI harness. Use when the user says rolldeep, roll deep,
  jupyter-like lab, roll a topic, DAA syllabus, or wants a private study roll.
  One command starts the UI; CLI/MCP is how models operate the same store.
---

# RollDeep harness

You are the backend. The browser is the roll surface. Data stays on the machine (`~/.rolldeep/`). The pool lives in repo files.

## Activate (human)

From the repo, after `npm install`:

```bash
rolldeep
```

Same idea as `jupyter lab`. Aliases: `rolldeep lab`, `rolldeep notebook`.

## Activate (any model)

Prefer files, then CLI. MCP if configured.

1. Read syllabi in `content/syllabi/`.
2. Write units to `content/units/<name>.json`.
3. Sync.

```json
{
  "title": "Course name",
  "units": [
    {
      "title": "Syllabus topic name",
      "question": "One sharp curiosity question. Never What is X?",
      "minutes": 40,
      "stars": 3,
      "sourceExcerpt": "module / section"
    }
  ]
}
```

```bash
rolldeep sync
rolldeep syllabi
rolldeep use --title "Course name"
rolldeep status
rolldeep roll
rolldeep choose --id <id>
rolldeep complete --id <id> --url https://... --notes "..."
```

MCP stdio: `rolldeep mcp`

Tools: `rolldeep_status`, `rolldeep_roll`, `rolldeep_choose`, `rolldeep_complete`, `rolldeep_library`, `rolldeep_pool`, `rolldeep_syllabi`, `rolldeep_use`, `rolldeep_add_units`, `rolldeep_sync`, `rolldeep_delete_available`.

## Rules

- Topic name and curiosity question are separate fields.
- Max 5 rolls per session. Only current + 3 previous stay visible.
- TAKE (`choose`) before complete. Proof URL required.
- Completed titles never return on that syllabus. Other syllabi keep their own progress.
- One `content/units/*.json` file is one syllabus. Switch with the lab dropdown or `rolldeep use`.
- Do not invent study templates or filming scripts.
- Do not call an extra model to mint units. Author them into the JSON files.
