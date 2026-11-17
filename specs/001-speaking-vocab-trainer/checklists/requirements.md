# Requirements Checklist: Speaking-First Vocabulary Trainer

**Purpose**: track each functional requirement to where it is implemented and how it was verified.
**Created**: 2026-11-17 | **Feature**: [spec.md](../spec.md)

Verification key: **U** = unit test, **B** = checked in Chrome via DevTools MCP, **M** = manual / pending.

- [x] CHK001 FR-001 topic create/rename/delete — `server/index.ts`, `TopicView` — B
- [x] CHK002 FR-002 add items one per line, duplicates skipped — `store.addItems` — U (importer), B
- [x] CHK003 FR-003 suggestions without repeats — `suggestTask` — B
- [x] CHK004 FR-004 enrichment (IPA, vi, definition, ≥2 examples, tip) — `enrichTask`, `matchEnriched` — U, B
- [x] CHK005 FR-005 British voice, normal/slow, cached replay — `tts.ts`, `audio.ts` — B
- [x] CHK006 FR-006 FSRS queue with daily new limit — `srs.ts` — U, B
- [x] CHK007 FR-007 recall-first listen/speak + shadowing — `Review.tsx` — B
- [x] CHK008 FR-008 local transcription + word comparison ignoring case/punctuation/contractions — `stt.ts`, `pronounce.ts` — U, B (TTS audio as input)
- [x] CHK009 FR-009 replay own recording beside model — `SpeakDrill` — M (needs a real mic)
- [x] CHK010 FR-010 Vietnamese coaching for missed words — `coachTask` — U
- [x] CHK011 FR-011 conversation with spoken reply + corrections + pronunciation hints — `Talk.tsx`, `talkTask` — U, B
- [x] CHK012 FR-012 voice choice, preview, speed — `Settings.tsx` — B
- [x] CHK013 FR-013 local persistence + progress stats — `store.ts`, `computeStats` — U, B
- [x] CHK014 FR-014 starter topics — `seed.ts` — B
- [x] CHK015 FR-015 add words from a Claude Code session — `.claude/skills/add-words`, `npm run import-words` — U, tested on a temp data dir

## Edge cases

- [x] CHK020 Claude missing / failing → readable banner, manual entry still works
- [x] CHK021 TTS unreachable → system `en-GB` voice fallback
- [x] CHK022 Silence/noise → "didn't catch that", no grade suggested
- [x] CHK023 External edit of `db.json` → reload by mtime; UI refreshes on focus/navigation
- [x] CHK024 Contractions/punctuation not counted as errors — U
- [x] CHK025 A crash in one screen does not blank the window (`ViewBoundary`)

## Notes

- Microphone capture could not be exercised in headless Chrome; STT was verified by feeding
  the app's own British TTS audio through `/api/stt`. Confirm with a real voice in the Electron window.
