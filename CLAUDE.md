# SpeakEasy UK — guidance for Claude Code

Desktop app (Electron) for a Vietnamese learner to study English words/phrases by topic,
through listening and speaking, with a British voice and Claude as tutor.

- Read `.specify/memory/constitution.md` first — it overrides convenience.
- Current feature: `specs/001-speaking-vocab-trainer/` (spec, plan, tasks, checklist).
- New features follow spec-kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Talk to the user in Vietnamese. UI copy is Vietnamese; learning content is British English.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API server + Vite + Electron window (normal use while developing) |
| `npm run dev:web` | API server + Vite only → open `http://localhost:5173` in Chrome (for DevTools MCP) |
| `npm start` | production build, then Electron |
| `npm run dist` | unpacked Windows build via electron-builder |
| `npm test` / `npm run typecheck` | vitest / tsc — both must pass before a task is done |
| `npm run import-words -- <file.json>` | import a batch of words into `data/db.json` |

## Architecture

- `electron/main.ts` starts `server/index.ts` in-process on `127.0.0.1:47821` (any free port
  if taken) and opens a window. Vite (5173) proxies `/api` in dev.
- Renderer ↔ server is `fetch('/api/…')` only, **no IPC**, so the same UI runs in Chrome.
- Data: `data/db.json` in dev; `%APPDATA%/SpeakEasy UK/data` when packaged; override with
  `SPEAKEASY_DATA_DIR`. `tts-cache/` and `models/` (Whisper) live beside it. The store reloads
  when the file's mtime changes, and the UI refreshes on window focus and navigation.
- Claude: `server/claude.ts` spawns `claude -p --output-format json --json-schema …`. Prompts,
  schemas and defensive normalisers are in `server/prompts.ts`. No API key.
- Voice: `server/tts.ts` (msedge-tts, `en-GB-*`, MP3 cache); `src/audio.ts` falls back to the
  OS `en-GB` voice. Note: TTS text goes to Microsoft's read-aloud service.
- STT: `server/stt.ts` runs Whisper `base.en` locally; the renderer posts 16 kHz Float32 PCM to
  `/api/stt?target=`. `server/pronounce.ts` aligns heard vs target words (similarity-weighted
  Levenshtein). Present results as "what the app heard", never as phonetic scores.
- Scheduling: `server/srs.ts` (FSRS via ts-fsrs). Items missing meaning/IPA/≥2 examples are
  "incomplete" and never enter review.

## Adding words for the learner

When the user says "thêm từ…", "gợi ý từ về…", "nạp mấy cụm này…", use the project skill
`.claude/skills/add-words/SKILL.md`: write full items (British IPA, Vietnamese meaning, 2–3
spoken British examples with translations, a Vietnamese pronunciation tip) to a scratchpad
JSON file and run `npm run import-words -- <file>`. Never hand-edit `data/db.json`.

## UI checks

After any UI change: `npm run dev:web`, open `http://localhost:5173` with the Chrome DevTools
MCP, take a snapshot/screenshot and read the console. Headless Chrome has no microphone —
test STT by posting TTS audio, and say so when reporting.

## Gotchas

- `useEffect(() => expr)` must not return a value: Chromium's `scrollIntoView` now returns a
  Promise, which React treats as a cleanup function and crashes. Use braces.
- Stop only processes you started (find them by command line); don't kill by port.
- Back up `data/db.json` before tests that grade cards in the real app, and restore it after.
