import { resolve } from "node:path";
import { readdirSync } from "node:fs";
import * as parse5 from "parse5";

const root = resolve(import.meta.dir, "..");
const catalogPath = resolve(root, "translations/gen/catalog.raw.json");
const outputPath = resolve(root, "translations/gen/glossary.clean.json");
const referencedCatalogPath = resolve(root, "translations/gen/catalog.json");
const compiledCatalogPath = resolve(root, "translations/en.full.json");
const bySourcePath = resolve(root, "translations/gen/by-source");
const handcraftedPath = resolve(root, "translations/glossary");
const catalog = await Bun.file(catalogPath).json() as Record<string, string>;
const entries = Object.entries(catalog).filter(([, english]) => english);
const han = /[\u3400-\u9fff]/g;

const handcrafted = new Map<string, string>();
for (const file of readdirSync(handcraftedPath).filter(file => file.endsWith(".json"))) {
  const values = await Bun.file(resolve(handcraftedPath, file)).json() as Record<string, string>;
  for (const [chinese, english] of Object.entries(values)) {
    if (handcrafted.has(chinese)) throw new Error(`Duplicate handcrafted glossary key: ${chinese}`);
    handcrafted.set(chinese, english);
  }
}

function chineseLength(value: string) {
  return value.match(han)?.length ?? 0;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

const glossary = new Map<string, string>();
for (const [chinese, english] of entries) {
  if (chineseLength(chinese) < 2 || handcrafted.has(chinese)) continue;
  const hasCleanUse = entries.some(([largerChinese]) =>
    largerChinese !== chinese && largerChinese.includes(chinese));
  if (hasCleanUse) glossary.set(chinese, english);
}

const authoritative = new Map([...glossary, ...handcrafted]);
const terms = [...authoritative].sort((a, b) =>
  chineseLength(b[0]) - chineseLength(a[0]) || b[1].length - a[1].length);

function words(value: string) {
  return [...value.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)];
}

// When the fork used an inconsistent translation, infer the contextual phrase
// from a smaller known term. "Colorful Gel" anchored on "Gel" can therefore
// match the contextual "Rainbow Gel" without losing the longer Chinese term.
function contextualMatch(chinese: string, canonical: string, text: string) {
  for (const [anchorChinese, anchorEnglish] of terms) {
    if (anchorChinese === chinese || !chinese.includes(anchorChinese)) continue;
    const canonicalAt = normalize(canonical).indexOf(normalize(anchorEnglish));
    const textAt = normalize(text).indexOf(normalize(anchorEnglish));
    if (canonicalAt < 0 || textAt < 0) continue;

    const before = words(canonical.slice(0, canonicalAt)).length;
    const after = words(canonical.slice(canonicalAt + anchorEnglish.length)).length;
    const textWords = words(text);
    const first = textWords.findIndex(match => match.index! <= textAt && match.index! + match[0].length > textAt);
    const lastPosition = textAt + anchorEnglish.length - 1;
    const last = textWords.findIndex(match => match.index! <= lastPosition && match.index! + match[0].length > lastPosition);
    if (first < before || last < 0 || last + after >= textWords.length) continue;

    const start = textWords[first - before].index!;
    const endWord = textWords[last + after];
    return { start, end: endWord.index! + endWord[0].length };
  }
  return null;
}

function resolveReferences(value: string) {
  let previous = "";
  while (value !== previous) {
    previous = value;
    value = value.replace(/\{\{[^|]*\|([\s\S]*?)\}\}/g, (_, english) => english);
  }
  return value;
}

function addReferences(chinese: string, english: string) {
  if (!english) return english;
  const matches: { start: number; end: number; marker: string }[] = [];
  const lower = english.toLocaleLowerCase("en");

  for (const [termChinese, termEnglish] of terms) {
    if (termChinese === chinese || !chinese.includes(termChinese)) continue;
    const needle = termEnglish.toLocaleLowerCase("en");
    let start = 0;
    let found = false;
    while ((start = lower.indexOf(needle, start)) !== -1) {
      const end = start + needle.length;
      if (!matches.some(match => start < match.end && end > match.start)) {
        matches.push({ start, end, marker: `{{${termChinese}|${resolveReferences(english.slice(start, end))}}}` });
        found = true;
      }
      start = end;
    }
    if (!found) {
      const inferred = contextualMatch(termChinese, termEnglish, english);
      if (inferred && !matches.some(match => inferred.start < match.end && inferred.end > match.start)) {
        matches.push({
          ...inferred,
          marker: `{{${termChinese}|${resolveReferences(english.slice(inferred.start, inferred.end))}}}`
        });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start);
  let result = "";
  let at = 0;
  for (const match of matches) {
    result += english.slice(at, match.start) + match.marker;
    at = match.end;
  }
  return result + english.slice(at);
}

function referenceKnownChinese(chinese: string) {
  const matches: { start: number; end: number; marker: string }[] = [];
  for (const [termChinese, termEnglish] of terms) {
    if (termChinese === chinese) continue;
    let start = 0;
    while ((start = chinese.indexOf(termChinese, start)) !== -1) {
      const end = start + termChinese.length;
      if (!matches.some(match => start < match.end && end > match.start)) {
        matches.push({ start, end, marker: `{{${termChinese}|${resolveReferences(termEnglish)}}}` });
      }
      start = end;
    }
  }
  if (!matches.length) return "<?>";
  matches.sort((a, b) => a.start - b.start);
  let result = "";
  let at = 0;
  for (const match of matches) {
    result += chinese.slice(at, match.start) + match.marker;
    at = match.end;
  }
  return result + chinese.slice(at);
}

function unwrapSharedHtml(chinese: string, english: string) {
  const outer = /^(\s*<([A-Za-z][\w:-]*)\b[^>]*>)([\s\S]*)(<\/([A-Za-z][\w:-]*)>\s*)$/;
  function layer(value: string) {
    const match = value.match(outer);
    if (!match || match[2] !== match[5]) return null;
    const fragment = parse5.parseFragment(value) as any;
    if (fragment.childNodes?.length !== 1 || fragment.childNodes[0].nodeName !== match[2].toLowerCase()) return null;
    return match;
  }

  function unwrap(value: string) {
    value = value
      .replace(/^(?:\s*<br\s*\/?\s*>)+/i, "")
      .replace(/(?:<br\s*\/?\s*>\s*)+$/i, "");
    while (true) {
      const match = layer(value);
      if (!match) break;
      value = match[3];
    }
    return value;
  }

  return [unwrap(chinese), english === "<?>" ? english : unwrap(english)] as const;
}

function normalizedEntries(values: Record<string, string>) {
  const normalized = new Map<string, string>();
  for (const [rawChinese, rawEnglish] of Object.entries(values)) {
    const [chinese, english] = unwrapSharedHtml(rawChinese, rawEnglish);
    if (handcrafted.has(chinese)) continue;
    if (!normalized.has(chinese)) normalized.set(chinese, english);
  }
  return normalized;
}

function referencedCatalog(values: Record<string, string>) {
  return Object.fromEntries([...normalizedEntries(values)].map(([chinese, english]) =>
    [chinese, english === "<?>" ? referenceKnownChinese(chinese) : addReferences(chinese, english)]));
}

function compileRaw(rawChinese: string, normalizedChinese: string, finalEnglish: string) {
  if (finalEnglish === "<?>") return rawChinese;
  const resolved = resolveReferences(finalEnglish);
  return rawChinese === normalizedChinese ? resolved : rawChinese.replace(normalizedChinese, resolved);
}

const filteredRaw = Object.fromEntries(normalizedEntries(catalog));
await Bun.write(catalogPath, JSON.stringify(filteredRaw, null, 2) + "\n");
const generatedGlossary = Object.fromEntries([...glossary]
  .sort(([a], [b]) => a.localeCompare(b, "zh"))
  .map(([chinese, english]) => [chinese, addReferences(chinese, english)]));
await Bun.write(outputPath, JSON.stringify(generatedGlossary, null, 2) + "\n");
await Bun.write(referencedCatalogPath, JSON.stringify(referencedCatalog(catalog), null, 2) + "\n");
const compiled = new Map<string, string>();
for (const file of readdirSync(bySourcePath).filter(file => file.endsWith(".json"))) {
  const path = resolve(bySourcePath, file);
  const values = await Bun.file(path).json() as Record<string, string>;
  const finalValues = referencedCatalog(values);
  for (const [rawChinese, rawEnglish] of Object.entries(values)) {
    const [normalizedChinese] = unwrapSharedHtml(rawChinese, rawEnglish);
    const finalEnglish = handcrafted.get(normalizedChinese) ?? finalValues[normalizedChinese];
    if (finalEnglish !== undefined && !compiled.has(rawChinese)) {
      compiled.set(rawChinese, compileRaw(rawChinese, normalizedChinese, finalEnglish));
    }
  }
  await Bun.write(path, JSON.stringify(finalValues, null, 2) + "\n");
}
// Runtime display-boundary lookups may use glossary terms that were not
// present as standalone strings in the historical source catalogs.
for (const [chinese, english] of handcrafted) {
  if (!compiled.has(chinese)) compiled.set(chinese, resolveReferences(english));
}
const sortedCompiled = Object.fromEntries([...compiled].sort(([a], [b]) => a.localeCompare(b, "zh")));
await Bun.write(compiledCatalogPath, JSON.stringify(sortedCompiled, null, 2) + "\n");

console.log(`Wrote ${glossary.size} additional generated glossary entries.`);
console.log(`Applied ${handcrafted.size} authoritative handcrafted glossary entries.`);
console.log("Removed handcrafted keys and added readable references in the generated catalogs.");
console.log(`Compiled ${compiled.size} raw source strings to translations/en.full.json.`);
