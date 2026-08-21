# RollDeep — how the agent works this lab

You are the backend. The browser is just the roll surface.

## Files you edit

| Path | What |
|---|---|
| `content/syllabi/*` | Raw syllabus drops (markdown/text). Read these. |
| `content/units/*.json` | The pool. You write these. One file per syllabus. |
| app/lib/cli/mcp | Product code. Change it when the lab needs to behave differently. |

SQLite in `~/.rolldeep/` is runtime state (rolls, streak, completions). Do not treat it as the source of the pool.

Unit file shape:

```json
{
  "title": "Source name",
  "units": [
    {
      "title": "Small enough for 25–60 min of depth",
      "question": "One sharp curiosity itch. Never 'What is X?'",
      "minutes": 40,
      "stars": 3,
      "sourceExcerpt": "where this came from"
    }
  ]
}
```

After writing unit files: they sync on Lab page load, or `npm run rd -- sync`.

## Commands

```bash
npm run lab                 # http://127.0.0.1:3210
npm run rd -- syllabi
npm run rd -- use --title "Course name"
npm run rd -- status
npm run rd -- roll
npm run rd -- choose --id <id>
npm run rd -- complete --id <id> --url https://... --notes "..."
npm run rd -- sync
npm run rd -- reset
```

## Workflow

1. User drops a syllabus into `content/syllabi/`.
2. You read it, break it into 25–60 minute units, write `content/units/<name>.json`.
3. Sync. User picks a syllabus in the dropdown (or `rolldeep use`). Hits ROLL (max 5 per session on that syllabus). They can see the current roll plus 3 previous and TAKE one.
4. User studies however they want and makes a video so they actually did it.
5. They mark completed with that proof. That title never rolls again on that syllabus. Other syllabi keep their own completion.

Hardness is 1–5 stars on each unit.

No study templates. No filming scripts. Proof is required to complete.

Do not call xAI to mint units. You author them.
