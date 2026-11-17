// Import words/phrases into the app's data file from a JSON file (or stdin).
//
//   npm run import-words -- path/to/words.json
//   cat words.json | npm run import-words
//
// JSON shape (one batch or an array of batches):
//   { "topic": { "name": "At the GP", "emoji": "🏥", "description": "..." },   // or "topicId": "..."
//     "items": [ "plain phrase", { "text", "ipa", "pos", "meaningVi", "definitionEn",
//                                  "examples": [{ "en", "vi" }], "tip" } ] }
//
// The running app re-reads the data file when it changes, so no restart is needed.
// Items without meaning/examples appear with a "Tạo nghĩa & ví dụ" button in the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Read the input before changing directory so relative paths work from anywhere.
const file = process.argv[2] ? path.resolve(process.argv[2]) : null;
process.chdir(root);

const outfile = path.join(root, 'dist-electron', 'import-words.mjs');
await esbuild.build({
  stdin: {
    contents: `export { importWords } from './server/importer'; export { load, save, dataDir } from './server/store';`,
    resolveDir: root,
    loader: 'ts',
  },
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'warning',
});
const { importWords, load, save, dataDir } = await import(pathToFileURL(outfile).href);

const text = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
let input;
try {
  input = JSON.parse(text.replace(/^﻿/, ''));
} catch (err) {
  console.error(`JSON không hợp lệ: ${err.message}`);
  process.exit(1);
}

try {
  const db = load();
  const reports = importWords(db, input);
  save(db);
  for (const r of reports) {
    console.log(`${r.created ? '＋ Chủ đề mới' : '• Chủ đề'} "${r.topic}" (${r.topicId}): thêm ${r.added.length}, bỏ qua ${r.skipped.length}`);
    for (const t of r.added) console.log(`    + ${t}${r.incomplete.includes(t) ? '  (chưa có nghĩa/ví dụ)' : ''}`);
    for (const t of r.skipped) console.log(`    = ${t}  (trùng hoặc quá dài)`);
  }
  console.log(`Đã lưu vào ${path.join(dataDir(), 'db.json')}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
