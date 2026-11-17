# Tasks: Speaking-First Vocabulary Trainer

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Tests**: unit tests for pure logic (constitution); UI verified with Chrome DevTools MCP.

Format: `- [x] T### [P] [US#] description` — `[P]` = parallelisable.

## Phase 1: Setup

- [x] T001 Scaffold Electron + React + Vite + Tailwind + TypeScript (`package.json`, `vite.config.ts`, `tsconfig.json`)
- [x] T002 [P] Dev/build scripts: `scripts/dev.mjs` (`dev`, `dev:web`), `scripts/build.mjs`, `scripts/bundle.mjs`
- [x] T003 [P] Chrome DevTools MCP in `.mcp.json`; spec-kit templates and constitution in `.specify/`

## Phase 2: Foundation

- [x] T010 Shared types in `shared/types.ts`
- [x] T011 JSON store with atomic save and mtime reload in `server/store.ts`
- [x] T012 Starter topics with complete items in `server/seed.ts`
- [x] T013 Local HTTP API skeleton, error handling, static serving in `server/index.ts`
- [x] T014 Claude CLI runner with JSON schema + timeout in `server/claude.ts`
- [x] T015 Electron shell with mic permission in `electron/main.ts`
- [x] T016 Renderer shell: hash router, app context, sidebar, toasts in `src/App.tsx`

## Phase 3: US1 — Build a topic (P1)

- [x] T020 [US1] Topic CRUD and add-lines endpoints
- [x] T021 [US1] Suggest + enrich prompts, schemas, normalisers in `server/prompts.ts`
- [x] T022 [P] [US1] TTS with disk cache in `server/tts.ts`; `src/audio.ts` with slow speed and system-voice fallback
- [x] T023 [US1] Home and TopicView screens (add, suggest, enrich, listen, edit, delete)
- [x] T024 [P] [US1] Tests: `normaliseItems`, `matchEnriched` in `tests/prompts.test.ts`
- [x] T025 [US1] `add-words` skill + `scripts/import-words.mjs` + `server/importer.ts` (FR-015)
- [x] T026 [P] [US1] Tests: `tests/importer.test.ts`

## Phase 4: US2 — Review (P1)

- [x] T030 [US2] FSRS scheduling, queue, stats, topic summaries in `server/srs.ts`
- [x] T031 [P] [US2] Tests in `tests/srs.test.ts`
- [x] T032 [US2] Review screen: listen/speak/learn modes, reveal, shadowing, grades, keyboard, requeue "Again"
- [x] T033 [US2] Sidebar badge and home counts refresh after each grade

## Phase 5: US3 — Pronunciation drill (P2)

- [x] T040 [US3] Local Whisper STT in `server/stt.ts`; mic capture → 16 kHz PCM in `src/audio.ts`
- [x] T041 [US3] Word alignment and scoring in `server/pronounce.ts`
- [x] T042 [P] [US3] Tests in `tests/pronounce.test.ts`
- [x] T043 [US3] `SpeakDrill` component: record, coloured words, replay own vs model, coaching
- [x] T044 [US3] Coach prompt and endpoint

## Phase 6: US4 — Talk with the tutor (P2)

- [x] T050 [US4] Talk prompt (reply + replyVi + feedback) and endpoint
- [x] T051 [US4] Talk screen: presets, topic scenarios, custom scenario, voice/typed replies, feedback card, "practise this" drill
- [x] T052 [US4] Fix: effect returned `scrollIntoView` Promise → crash on unmount; add `ViewBoundary`

## Phase 7: US5 — Voice settings (P3)

- [x] T060 [US5] Settings: voice preview/select, speed, level, model, new-per-day, health status

## Phase 8: Polish

- [x] T070 Refresh state on window focus / navigation (external imports appear)
- [x] T071 Favicon; British-only alternatives in tutor corrections
- [x] T072 `CLAUDE.md` runtime guidance; `README.md` for the learner
- [ ] T073 Package an installer (`npm run dist`) and test on a clean machine
- [ ] T074 Verify microphone recording end to end in the Electron window with a real voice
