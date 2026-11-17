# Implementation Plan: Speaking-First Vocabulary Trainer

**Branch**: `001-speaking-vocab-trainer` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

## Summary

A Windows desktop app (Electron) for a Vietnamese learner to study English words and phrases
by topic through listening and speaking. Claude Code (headless CLI) writes IPA, meanings,
examples, suggestions, pronunciation coaching and tutor replies; Microsoft Edge neural
`en-GB` voices speak; Whisper transcribes the learner locally; FSRS schedules reviews.

## Technical Context

**Language/Version**: TypeScript 7 on Node 22 (Electron 45 main process), React 19 renderer
**Primary Dependencies**: Electron, React, Tailwind v4, Vite 8, `ts-fsrs`, `msedge-tts`,
`@huggingface/transformers` (Whisper `base.en`), esbuild for the main/server bundle
**Storage**: one JSON file `data/db.json` (dev) or `%APPDATA%/SpeakEasy UK/data/db.json`
(installed); MP3 cache in `tts-cache/`, speech model in `models/` beside it
**Testing**: vitest for pure logic; Chrome DevTools MCP for UI checks
**Target Platform**: Windows 10/11 desktop (works on macOS/Linux too, untested)
**Project Type**: desktop app = local HTTP API + web renderer in an Electron window
**Performance Goals**: STT ≤ 5 s for 15 words (≈1 s measured); cached audio instant
**Constraints**: no API keys, no telemetry; network only for Claude, TTS, one model download
**Scale/Scope**: single learner, hundreds to a few thousand items

## Constitution Check

| Principle | How the design satisfies it |
|---|---|
| I. Ears and mouth first | Every study screen autoplays audio; review alternates listen/speak and ends in shadowing. |
| II. Chunks in context | Items are "incomplete" until they have meaning, IPA and ≥2 examples; incomplete items are excluded from review. |
| III. Scheduled remembering | FSRS state per item in `db.json`; `buildQueue` is the only source of "due". |
| IV. One British voice | Only `en-GB-*` voices offered; prompts demand British spelling/vocabulary and praise-first feedback. |
| V. Honest feedback | UI says "app nghe được"; scores are word-match percentages from Whisper; coach prompt forbids invented measurements. |
| VI. Local-first | JSON file, local Whisper, `127.0.0.1` server, Claude via the learner's own CLI login. |

No violations; no complexity table needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-speaking-vocab-trainer/
├── spec.md
├── plan.md              # this file
├── tasks.md
└── checklists/requirements.md
```

### Source Code

```text
electron/main.ts        # window + mic permission; starts server in-process
server/
├── index.ts            # HTTP API on 127.0.0.1:47821 (routes below), static files in prod
├── store.ts            # db.json load/save (atomic write, mtime-based reload), makeItem/addItems
├── seed.ts             # starter topics with complete items
├── srs.ts              # FSRS scheduling, review queue, stats, topic summaries
├── pronounce.ts        # tokenise + similarity-weighted alignment of heard vs target
├── claude.ts           # spawn `claude -p --output-format json --json-schema`
├── prompts.ts          # task prompts + JSON schemas + normalisers (enrich, suggest, coach, talk)
├── importer.ts         # batch import used by scripts/import-words.mjs
├── tts.ts              # msedge-tts → cached MP3
└── stt.ts              # Whisper base.en via transformers.js (16 kHz Float32 PCM in)
shared/types.ts         # types shared by server and renderer
src/                    # React renderer (hash router, views/, components/SpeakDrill)
scripts/                # dev.mjs, build.mjs, bundle.mjs, import-words.mjs
tests/                  # vitest: pronounce, srs, prompts, importer
.claude/skills/add-words/SKILL.md   # "thêm từ…" from a Claude Code session
```

**Structure Decision**: renderer ↔ server over `fetch('/api/…')` only (no IPC) so the exact UI
runs in plain Chrome for DevTools MCP inspection (`npm run dev:web`).

## API (local, JSON unless noted)

| Method & path | Purpose |
|---|---|
| `GET /api/state` | topics with counts, settings, stats |
| `GET /api/health` | Claude CLI and Whisper status |
| `POST /api/topics` · `GET/PATCH/DELETE /api/topics/:id` | topic CRUD (GET returns items) |
| `POST /api/topics/:id/items` | add lines `{ lines }` |
| `POST /api/topics/:id/suggest` | Claude suggests `{ count, level, hint }` |
| `POST /api/topics/:id/enrich` | Claude fills IPA/meaning/examples/tip |
| `PATCH/DELETE /api/items/:id` | edit / delete item (`resetSrs`) |
| `GET /api/review?topicId=` · `POST /api/review` | queue · grade `{ itemId, rating, mode, score }` |
| `GET /api/voices` · `GET /api/tts?text&voice&rate` | voice list · MP3 |
| `POST /api/stt?target=` · `POST /api/stt/warmup` | Float32 PCM → transcript + comparison |
| `POST /api/coach` · `POST /api/talk` | pronunciation coaching · tutor turn |
| `PUT /api/settings` | voice, rate, level, model, newPerDay |

## Key Decisions

- **Claude through the CLI, not the API**: no key handling; uses the learner's subscription.
  Structured output via `--json-schema`; every response is normalised defensively.
- **Edge neural voices**: the most natural free British voices; cached so replays are instant
  and offline. Fallback: the OS `en-GB` voice via `speechSynthesis`.
- **Whisper locally**: privacy and no per-call cost. Scoring is word alignment (Levenshtein
  DP with similarity-weighted substitutions) — honest "what was heard", not phoneme scoring.
- **FSRS** over SM-2: better retention per review; `ts-fsrs` is small and well tested.
- **JSON file with mtime reload**: lets the `add-words` skill import while the app runs.
