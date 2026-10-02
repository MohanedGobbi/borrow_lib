// Fails when the EN, FR and AR dictionaries in src/i18n/index.tsx do not have the same keys.
//   node scripts/check-i18n.mjs
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/i18n/index.tsx", import.meta.url), "utf8");
const langs = ["en", "fr", "ar"];

function keysOf(lang) {
  const start = source.indexOf(`const ${lang}: Dict = {`);
  if (start < 0) throw new Error(`dictionary "${lang}" not found in src/i18n/index.tsx`);
  const end = source.indexOf("\n};", start);
  const body = source.slice(start, end);
  // "key": "value" pairs; matching the whole pair keeps text inside values from being read as keys.
  const pair = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  return new Set([...body.matchAll(pair)].map((m) => m[1]));
}

const dicts = Object.fromEntries(langs.map((l) => [l, keysOf(l)]));
const all = new Set(langs.flatMap((l) => [...dicts[l]]));
let failed = false;

for (const lang of langs) {
  const missing = [...all].filter((k) => !dicts[lang].has(k)).sort();
  if (missing.length) {
    failed = true;
    console.error(`${lang.toUpperCase()} is missing ${missing.length} key(s):`);
    for (const k of missing) console.error(`  ${k}`);
  }
}

if (failed) process.exit(1);
console.log(`i18n OK: ${all.size} keys in each of ${langs.map((l) => l.toUpperCase()).join(", ")}.`);
