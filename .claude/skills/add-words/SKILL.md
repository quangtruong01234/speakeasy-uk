---
name: add-words
description: Add English words or phrases to the SpeakEasy UK app from this Claude Code session - either the learner's own list or phrases Claude suggests for a topic - complete with British IPA, Vietnamese meaning, examples and a pronunciation tip. Use when the user says things like "thêm từ", "gợi ý từ về chủ đề…", "add words/phrases about…", "nạp mấy cụm này vào app".
---

# Add words to SpeakEasy UK

The app stores everything in `data/db.json`. Never edit that file by hand: write a JSON batch
and run the importer, which de-duplicates per topic, creates missing topics and saves atomically.
The running app picks the change up by itself.

## 1. Decide topic and items

- Topic: reuse an existing one when it fits. List them with
  `node -e "const d=require('./data/db.json');for(const t of d.topics)console.log(t.id,'|',t.name,'|',d.items.filter(i=>i.topicId===t.id).length)"`.
  Otherwise give a new `topic` with a Vietnamese `name`, one emoji and a short `description`.
- Learner's own list: keep their wording (fix only obvious typos, and say so).
- Suggesting: 8–12 items unless asked. Prefer phrases and collocations people really say in
  the UK over single words; skip anything already in that topic. Match the learner's level
  (`settings.level` in db.json, default B1).

## 2. Write each item (follow the constitution in `.specify/memory/constitution.md`)

```json
{
  "text": "Could I have the bill, please?",
  "ipa": "/kʊd aɪ hæv ðə bɪl pliːz/",
  "pos": "question",
  "meaningVi": "Cho tôi xin hoá đơn nhé?",
  "definitionEn": "A polite way to ask to pay at a restaurant.",
  "examples": [
    { "en": "Could I have the bill, please? We're in a bit of a rush.", "vi": "Cho tôi xin hoá đơn nhé, chúng tôi hơi vội." },
    { "en": "That was lovely, thanks. Could I have the bill, please?", "vi": "Ngon lắm, cảm ơn. Cho tôi xin hoá đơn nhé?" }
  ],
  "tip": "\"have the\" nối thành /hæv ðə/ — đặt lưỡi giữa hai răng cho /ð/. \"bill\" là /ɪ/ ngắn, đừng kéo thành \"biu\"."
}
```

- `ipa`: British (RP) IPA of the whole item, in slashes.
- `pos`: word, phrase, idiom, phrasal verb, question, sentence, noun, verb, adjective…
- `examples`: 2–3 natural spoken British sentences, 6–14 words, British spelling and
  vocabulary (flat, queue, cheers, brilliant), each with a natural Vietnamese translation.
- `tip`: Vietnamese, practical: linking, weak forms, stress, final consonants, sounds
  Vietnamese speakers find hard (/θ ð/, /ʃ/, /r/ vs /l/, final /s z t d k/, long vs short vowels).
- A plain string is allowed for an item; the app can generate the rest later
  ("Tạo nghĩa & ví dụ"), but prefer full items.

## 3. Import

Write the batch to a temporary file (scratchpad, not the repo) and run:

```
npm run import-words -- <path-to-batch.json>
```

Batch shape: `{ "topic": { "name", "emoji", "description" } | "topicId": "...", "items": [...] }`,
or an array of batches. Report the importer's output to the learner in Vietnamese: what was
added, what was skipped as a duplicate, and that they can open the topic in the app to
listen and practise.
