# SpeakEasy UK Constitution

## Core Principles

### I. Ears and Mouth First
Every learning interaction MUST involve hearing English or saying it aloud. A screen that
only asks the learner to read or type is a defect unless it is a setup screen (adding words,
settings). Audio plays by default; text is the support, not the lesson.

### II. Chunks in Context, Never Bare Words
An item is not ready to study until it has a meaning in Vietnamese, British IPA, and at least
two example sentences that sound like something a friendly British person would actually say
out loud. Prefer phrases and collocations over isolated words. Examples are short enough to
shadow in one breath (roughly 6–14 words).

### III. Remembering Is Scheduled, Not Hoped For
Every studied item is scheduled by spaced repetition (FSRS). Reviews are recall-first: the
learner retrieves the item (by ear or by voice) before seeing the answer. The schedule lives
in the data file and is the single source of truth for "what is due".

### IV. One British Voice, Warm and Natural
All model audio is British English (en-GB) from a neural voice chosen by the learner. Tutor
text (examples, replies, feedback) uses British spelling, British vocabulary and a warm,
encouraging tone. Feedback names what was good before what to fix, and never shames.

### V. Honest Feedback
Pronunciation feedback is derived from what a local speech recogniser heard, compared with
the target. The UI MUST present it as "what the app heard", never as a precise phonetic
score. Claude's coaching may explain likely causes (final consonants, /θ/ vs /s/, vowel
length, stress) but must not invent measurements.

### VI. Local-First and Simple
The app is a single-user desktop app. Learner data is one human-readable JSON file on the
learner's machine. Speech recognition runs locally. The only network calls are: Claude (via
the learner's own Claude Code login), the neural TTS voice, and a one-time speech model
download. No accounts, no API keys in the repo, no telemetry. Add a dependency only when it
removes more code than it adds risk.

## Technology Constraints

- Desktop shell: Electron. UI: React + TypeScript + Tailwind, built with Vite.
- All backend logic lives in `server/` as a local HTTP API bound to `127.0.0.1`. The
  renderer talks to it with `fetch('/api/...')` only — no Electron IPC — so the same UI can
  be opened in plain Chrome for inspection with the Chrome DevTools MCP server.
- Claude is reached by spawning the Claude Code CLI headlessly (`claude -p`) with structured
  JSON output. No Anthropic API key is stored or required.
- Voice: Microsoft Edge neural voices (`en-GB-*`), cached to disk as MP3 after first use.
- Speech-to-text: Whisper (English) running locally through `@huggingface/transformers`.
- UI copy is Vietnamese; all learning content is English.

## Development Workflow

- Features follow the spec-kit flow: `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. Specs live in `specs/NNN-name/`.
- Pure logic (scheduling, pronunciation alignment, prompt parsing) has unit tests (`npm test`).
- Any UI change is checked in a real browser through the Chrome DevTools MCP server
  (`npm run dev:web`, then open `http://localhost:5173`): take a snapshot/screenshot and
  read the console before calling the change done.
- `npm run typecheck` and `npm test` pass before a task is marked complete.

## Governance

This constitution overrides convenience. A change that conflicts with a principle needs the
principle amended first (bump the version, note the reason in the commit). Runtime guidance
for AI agents is in `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
