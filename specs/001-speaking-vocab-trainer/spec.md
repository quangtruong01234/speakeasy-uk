# Feature Specification: Speaking-First Vocabulary Trainer

**Feature Branch**: `001-speaking-vocab-trainer`

**Created**: 2026-11-17

**Status**: Implemented (v0.1)

**Input**: User description: "A desktop app in this folder for practising English. I enter
words and phrases, or the assistant proposes them, grouped by topic, with the focus on
listening and speaking. Once the words exist, Claude Code itself produces the examples. Then
I review so I don't forget, using a method that leaves my speech natural and friendly. There
is also a feature where Claude and I talk so my pronunciation gets corrected. British voice."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build a topic of words and phrases (Priority: P1)

The learner creates a topic (for example "Ordering at a café"), then either types their own
words and phrases or asks the tutor to suggest some for that topic and level. For every item
the tutor fills in the British pronunciation (IPA), the meaning in Vietnamese, a short
English definition, natural spoken example sentences with Vietnamese translations, and a
pronunciation tip aimed at Vietnamese speakers. The learner can listen to the item and every
example in a British voice straight away.

**Why this priority**: Without items that carry meaning, audio and examples there is nothing
to learn or review. It is also the smallest slice that is already useful as a listening tool.

**Independent Test**: Create a topic, add three phrases by hand, ask for five suggestions,
press "create examples", and play the audio of an item and an example.

**Acceptance Scenarios**:

1. **Given** no topics, **When** the app first opens, **Then** starter topics with complete
   items are present so the learner can begin immediately.
2. **Given** a topic, **When** the learner pastes several lines of words/phrases, **Then**
   each line becomes an item and duplicates within the topic are skipped.
3. **Given** a topic, **When** the learner asks for suggestions, **Then** new speaking-useful
   items that are not already in the topic are added.
4. **Given** items without examples, **When** the learner asks the tutor for examples,
   **Then** each item gains IPA, Vietnamese meaning, definition, at least two example
   sentences with translations, and a pronunciation tip.
5. **Given** a complete item, **When** the learner presses listen on the item or an example,
   **Then** it is spoken in the chosen British voice, at normal or slow speed.

---

### User Story 2 - Review so nothing is forgotten (Priority: P1)

Each day the learner opens a review session. New items are introduced with audio first; due
items are tested by recall. Two recall styles alternate: *listen* (hear it, recall the
meaning, then reveal) and *speak* (see the Vietnamese meaning, say the English aloud). After
recalling, the learner shadows an example sentence — listens, repeats it, and sees which
words were heard. The learner grades the card (Again / Hard / Good / Easy) and the app
schedules the next review at an expanding interval.

**Why this priority**: Retention is the stated goal. Recall plus shadowing is what turns
recognised words into phrases the learner can actually say with natural rhythm.

**Independent Test**: With starter items, run a session of five cards, grade them, and see
the due count drop and each item show a next-review date.

**Acceptance Scenarios**:

1. **Given** new and due items, **When** a session starts, **Then** due items come first,
   followed by new items up to the daily limit.
2. **Given** a card in listen mode, **When** it appears, **Then** audio plays and the text
   and meaning stay hidden until the learner reveals them.
3. **Given** a card in speak mode, **When** the learner says the item, **Then** the app shows
   what it heard, marks matched and missed words, and suggests a grade.
4. **Given** a graded card, **When** the grade is "Again", **Then** the card returns later in
   the same session; otherwise it is scheduled for a future day.
5. **Given** the session is finished, **When** the learner returns home, **Then** today's
   count, streak and next due time are shown.

---

### User Story 3 - Fix pronunciation on any word or sentence (Priority: P2)

On any item or example the learner can open a speaking drill: listen to the model voice,
record themselves, see word by word what the app heard, replay their own recording next to
the model, and ask the tutor for coaching on the words that were missed.

**Why this priority**: It is the feedback loop that makes speaking practice effective, and
it is reused by review and conversation.

**Independent Test**: Open a drill on a sentence, record it, see coloured words and a
percentage, play back both recordings, and request coaching.

**Acceptance Scenarios**:

1. **Given** a target sentence, **When** the learner records it, **Then** each target word is
   marked heard or missed and an overall match percentage is shown.
2. **Given** a result with missed words, **When** the learner asks for coaching, **Then** the
   tutor explains in Vietnamese how to produce those words (IPA, mouth position, stress,
   linking) in an encouraging tone.
3. **Given** no microphone or a denied permission, **When** the learner tries to record,
   **Then** a clear message explains how to enable it and listening still works.

---

### User Story 4 - Talk with the tutor (Priority: P2)

The learner picks a scenario (optionally tied to a topic) and has a spoken conversation. The
tutor speaks first in a British voice. The learner answers by voice (or by typing). After
each turn the tutor replies naturally and, separately, shows gentle corrections: a more
natural way to say it, and pronunciation hints for words that were probably misheard because
of how they were said. The tutor steers the chat so the topic's phrases get used.

**Why this priority**: Real-time use is the goal of the whole app, but it depends on the
voice, recognition and item pieces above.

**Independent Test**: Start a conversation on a starter topic, answer two turns by voice or
text, hear spoken replies and see at least one correction card.

**Acceptance Scenarios**:

1. **Given** a chosen scenario, **When** the conversation starts, **Then** the tutor greets
   the learner in speech and text.
2. **Given** a learner turn, **When** it is sent, **Then** the tutor's reply is spoken and a
   feedback card lists corrections (if any) with a "practise this" action.
3. **Given** a correction, **When** the learner chooses to practise it, **Then** a speaking
   drill opens with the improved sentence as the target.

---

### User Story 5 - Choose a British voice (Priority: P3)

The learner previews the available British voices, picks one, and sets the speaking speed.

**Independent Test**: Preview two voices, select one, and hear it used in a topic.

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** the learner presses preview on a voice, **Then** a
   sample sentence is spoken in that voice.
2. **Given** a selected voice and speed, **When** any audio plays later, **Then** it uses them.

### Edge Cases

- The tutor (Claude Code) is not installed, not logged in, or times out → the action fails
  with a readable message; nothing already saved is lost; manual entry still works.
- The voice service is unreachable → fall back to a built-in British system voice.
- The speech model is still downloading on first use → show progress text, do not freeze.
- The learner records silence or noise → "didn't catch that", no grade suggested.
- An item is a single short word → recognition may be unreliable; the learner can always
  override the suggested grade.
- The data file is edited externally (for example by Claude Code adding words) → changes
  appear on the next screen load without restarting.
- Punctuation, contractions and case differences ("I'm" vs "I am") must not count as errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Learners MUST be able to create, rename and delete topics.
- **FR-002**: Learners MUST be able to add items to a topic by typing or pasting, one per line.
- **FR-003**: The system MUST be able to suggest new items for a topic at a chosen level,
  favouring spoken phrases and collocations, without repeating existing items.
- **FR-004**: The system MUST enrich items with British IPA, Vietnamese meaning, English
  definition, ≥2 natural spoken examples with Vietnamese translations, and a pronunciation
  tip, using the learner's own Claude Code.
- **FR-005**: The system MUST speak any item, example or tutor reply in the selected British
  voice, at normal and slow speeds, and replay previously heard audio without delay.
- **FR-006**: The system MUST schedule every studied item with spaced repetition and present
  a daily queue of due and new items with a configurable new-item limit.
- **FR-007**: Review MUST be recall-first with alternating listen and speak modes, followed by
  shadowing an example sentence.
- **FR-008**: The system MUST record the learner, transcribe locally, compare with the target
  word by word (ignoring case, punctuation and common contractions) and show the result.
- **FR-009**: Learners MUST be able to replay their own recording alongside the model voice.
- **FR-010**: The tutor MUST give pronunciation coaching in Vietnamese for missed words.
- **FR-011**: The system MUST support a turn-based spoken conversation with the tutor that
  returns a spoken reply plus separate corrections and pronunciation hints.
- **FR-012**: Learners MUST be able to choose among British voices, preview them, and set speed.
- **FR-013**: The system MUST persist topics, items, schedules, history and settings locally
  and show progress (due today, reviewed today, streak, items learned).
- **FR-014**: The system MUST ship with starter topics so it is usable before any tutor call.
- **FR-015**: Items MUST also be addable from a Claude Code session in this folder (a project
  skill that writes examples and imports them), so the learner can say "add words about X".

### Key Entities

- **Topic**: a named theme with an emoji and optional description; owns items.
- **Item**: a word or phrase with IPA, part of speech, Vietnamese meaning, English definition,
  examples, pronunciation tip, and its review schedule.
- **Example**: an English sentence and its Vietnamese translation.
- **Review log**: when an item was reviewed, in which mode, the grade, and the speech score.
- **Settings**: voice, speed, tutor model, daily new-item limit, learner level.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time learner hears their first British example within 30 seconds of
  opening the app, without configuring anything.
- **SC-002**: Adding ten items to a topic and getting complete examples takes under two minutes.
- **SC-003**: A ten-card review session can be completed in under eight minutes, with the
  learner speaking aloud at least once per card.
- **SC-004**: After recording, the learner sees word-by-word feedback within five seconds for
  a sentence of up to fifteen words (after the first-use model download).
- **SC-005**: A conversation turn (learner stops speaking → tutor starts speaking) takes under
  ten seconds.
- **SC-006**: Previously played audio replays instantly and works without a connection.

## Assumptions

- Single learner, Vietnamese native speaker, Windows desktop with a microphone and speakers.
- Claude Code is installed and logged in on the same machine; its subscription covers tutor calls.
- Internet is available for tutor calls, first-time voice audio, and the one-time speech model
  download; listening to cached audio and reviewing work offline.
- "Pronunciation correction" means recogniser-based word-level feedback plus tutor coaching,
  not laboratory-grade phoneme scoring (see Constitution V).
- Mobile and multi-user sync are out of scope.
