import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const compiledPath = resolve(root, "translations/en.full.json");
const glossaryPath = resolve(root, "translations/glossary");
const outputPath = resolve(root, "translations/gen/bracket-glossary.json");
const compiled = await Bun.file(compiledPath).json() as Record<string, string>;
const authoritative = new Map<string, string>();
const han = /[\u3400-\u9fff]/;
const bracket = /【([^【】]+)】/g;
const translatedBracket = /【([^【】]+)】|\[([^\[\]]+)\]/g;

for (const file of readdirSync(glossaryPath).filter(file => file.endsWith(".json"))) {
  const values = await Bun.file(resolve(glossaryPath, file)).json() as Record<string, string>;
  for (const [chinese, english] of Object.entries(values)) authoritative.set(chinese, english);
}

const candidates = new Map<string, Map<string, number>>();
for (const [raw, final] of Object.entries(compiled)) {
  const sourceTerms = [...raw.matchAll(bracket)].map(match => match[1]);
  const finalTerms = [...final.matchAll(translatedBracket)].map(match => match[1] ?? match[2]);
  for (let index = 0; index < sourceTerms.length; index++) {
    const chinese = sourceTerms[index];
    if (!han.test(chinese)) continue;
    const exact = compiled[chinese];
    const inferred = authoritative.get(chinese) ??
      (exact && exact !== chinese && !han.test(exact) ? exact : undefined) ??
      (sourceTerms.length === finalTerms.length && !han.test(finalTerms[index]) ? finalTerms[index] : "<?>");
    const options = candidates.get(chinese) ?? new Map<string, number>();
    options.set(inferred, (options.get(inferred) ?? 0) + 1);
    candidates.set(chinese, options);
  }
}

const glossary = Object.fromEntries([...candidates]
  .sort(([a], [b]) => a.localeCompare(b, "zh"))
  .map(([chinese, options]) => {
    const ranked = [...options].sort((a, b) =>
      (a[0] === "<?>" ? 1 : 0) - (b[0] === "<?>" ? 1 : 0) || b[1] - a[1]);
    return [chinese, ranked[0]?.[0] ?? "<?>"];
  }));

const allTerms = new Map([...authoritative, ...Object.entries(glossary)]);
function referenceLongestContained(chinese: string, english: string) {
  const contained = [...allTerms]
    .filter(([termChinese, termEnglish]) =>
      termChinese !== chinese && chinese.includes(termChinese) &&
      english.toLocaleLowerCase("en").includes(termEnglish.toLocaleLowerCase("en")))
    .sort((a, b) => b[0].length - a[0].length || b[1].length - a[1].length)[0];
  if (!contained) return english;
  const [termChinese, termEnglish] = contained;
  const at = english.toLocaleLowerCase("en").indexOf(termEnglish.toLocaleLowerCase("en"));
  return english.slice(0, at) + `{{${termChinese}|${english.slice(at, at + termEnglish.length)}}}` + english.slice(at + termEnglish.length);
}

const referenced = Object.fromEntries(Object.entries(glossary).map(([chinese, english]) =>
  [chinese, referenceLongestContained(chinese, english)]));

await Bun.write(outputPath, JSON.stringify(referenced, null, 2) + "\n");
const missing = Object.values(glossary).filter(value => value === "<?>").length;
console.log(`Wrote ${Object.keys(glossary).length} bracket terms to translations/gen/bracket-glossary.json (${missing} untranslated).`);
