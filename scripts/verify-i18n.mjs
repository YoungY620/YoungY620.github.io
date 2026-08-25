import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const localeNames = ["zh", "en", "ja"];
const dictionaries = Object.fromEntries(await Promise.all(localeNames.map(async (locale) => [
  locale,
  JSON.parse(await readFile(resolve(root, `src/i18n/${locale}.json`), "utf8")),
])));
const referenceKeys = Object.keys(dictionaries.zh).sort();

for (const locale of localeNames) {
  const keys = Object.keys(dictionaries[locale]).sort();
  const missing = referenceKeys.filter((key) => !(key in dictionaries[locale]));
  const extra = keys.filter((key) => !(key in dictionaries.zh));
  const empty = keys.filter((key) => typeof dictionaries[locale][key] !== "string" || !dictionaries[locale][key].trim());
  if (missing.length || extra.length || empty.length) {
    throw new Error(`${locale} dictionary mismatch: missing=${missing.join(",")} extra=${extra.join(",")} empty=${empty.join(",")}`);
  }
}

const centralizedSources = [
  "src/world/world-module/server.ts",
  "src/world/world-module/events.ts",
  "src/world/world-module/player.ts",
  "scripts/generate-pages.mjs",
];
for (const relativePath of centralizedSources) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  if (/\btri\s*\(|\blocalText\s*\(/.test(source)) {
    throw new Error(`Inline translation helper remains in ${relativePath}`);
  }
}

console.log(`Verified ${referenceKeys.length} aligned keys across zh, en and ja dictionaries.`);
