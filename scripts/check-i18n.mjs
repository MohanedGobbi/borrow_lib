// Fails when the EN, FR and AR dictionaries in src/i18n/index.tsx do not have the same keys,
// or when the code calls t("some.key") with a key no dictionary defines (it would show the raw key).
//   node scripts/check-i18n.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

// Literal keys only: t(`demo.as.${key}`) and other built names are not checked.
function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.tsx?$/.test(entry.name)) yield path;
  }
}
const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const used = /\bt\(\s*"([A-Za-z][\w.-]*)"/g;
const unknown = new Map();
for (const file of sources(srcDir)) {
  for (const m of readFileSync(file, "utf8").matchAll(used)) {
    if (!all.has(m[1])) unknown.set(m[1], file.slice(srcDir.length + 1));
  }
}
if (unknown.size) {
  failed = true;
  console.error(`The code uses ${unknown.size} key(s) no dictionary defines:`);
  for (const [k, f] of [...unknown].sort()) console.error(`  ${k}  (${f})`);
}

if (failed) process.exit(1);
console.log(`i18n OK: ${all.size} keys in each of ${langs.map((l) => l.toUpperCase()).join(", ")}.`);
