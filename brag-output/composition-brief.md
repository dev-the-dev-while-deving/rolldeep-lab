# Hyperframes Composition Brief: ROLLDEEP

## Objective
Create a short launch-style brag video for ROLLDEEP, positioned as a free local study product: one ROLL, one topic, one question, then you actually do the work.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/Users/devarsheejmude/Projects/discipline`
- Primary files read: README.md, app/globals.css, app/layout.tsx, app/page.tsx, components/topic-card.tsx, components/roll-button.tsx, components/shell.tsx
- Product name: ROLLDEEP
- Tagline / strongest claim: Local lab. One topic. Deep work. Never repeat.
- Key UI or visual moment to recreate: Giant vermillion ROLL button (press offset), then the topic card with TOPIC / QUESTION labels, stars, 50 MIN chip, TAKE THIS bar
- Copy that must appear verbatim:
  - YOU DON'T HAVE A SYLLABUS PROBLEM.
  - YOU HAVE A CHOOSING PROBLEM.
  - ROLLDEEP
  - ROLL
  - TOPIC
  - QUESTION
  - Dijkstra's algorithm
  - If a vertex is already marked "done", what can a later negative edge do that Dijkstra has already forbidden itself from undoing?
  - TAKE THIS
  - Free. Local. One topic. Never repeat.

## Creative Direction
- Tone preset: default
- Creative direction: free product that sells discipline — neo-brutalist study tool, not a dashboard
- Interpretation: Punchy type, hard cuts, hold long enough to read. Mean on purpose.
- Angle: Study apps sell choice. ROLLDEEP sells the opposite.
- Hook: YOU DON'T HAVE A SYLLABUS PROBLEM.
- Outro / punchline: ROLLDEEP / Free. Local. One topic. Never repeat.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Soft rounded UI

## Visual Identity
- Background: #f4efe4
- Text: #0a0a0a
- Accent: #ff3b1f
- Signal: #ffe600
- Display font: Archivo Black
- Body font: Space Grotesk
- Visual references from the project: 4px solid black borders, 8px 8px 0 #000 shadows, 0 radius, grid overlay, yellow time chip, red ROLL, black TAKE THIS

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3s — YOU DON'T HAVE A SYLLABUS PROBLEM.
2. Reveal — 3s — YOU HAVE A CHOOSING PROBLEM. + ROLLDEEP wordmark
3. ROLL — 5s — real ROLL button, cursor click, press
4. The card — 6s — Dijkstra topic + question + stars + TAKE THIS
5. Outro — 3s — black, ROLLDEEP, free/local tagline, GitHub URL

## Audio
- Audio role: punchy upbeat bed
- Audio arc: bed throughout, dice+click on ROLL, card land, bell on outro with fade
- Music: happy-beats-business-moves-vol-10-by-ende-dot-app.mp3
- Music treatment: volume 0.32, fade last 1.2s
- Music cue guidance: bundled preset vol-10, tempo ~110. Lock outro to 18.01s strong cue. Sequential snaps 6.28 / 6.82 / 7.35 / 11.47.
- Audio-reactive treatment: subtle; ROLL button shadow and yellow chip glow with RMS
- Audio-coupled moments:
  - Scene 3 — simulated click
  - Scene 4 — card sequence
  - Scene 5 — final logo
- SFX selection guidance: dice-shake then click for ROLL; card-place for card; impactBell_heavy_000 for outro
- SFX analysis guidance: ~/.grok/skills/brag/assets/sfx/sfx-analysis.md
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills. /brag is its own workflow: do not enter the hyperframes entry-point intent interview.

Requirements:
- Show at least one real UI element from ROLLDEEP (the ROLL button and the topic card).
- Keep all text readable.
- Keep the video within 15-25 seconds (target 20).
- Include music/SFX.
- Beat-lock outro to ~18.01s.
- Full-screen scene fills on a child, not the root.
- Root data-start="0", 1920x1080, data-duration="20"
- class="clip" on visual clips, direct children of root
- No CSS transform fighting GSAP
- Google fonts: Archivo Black, Space Grotesk, IBM Plex Mono
