import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const catalogsPath = resolve(root, "translations/gen/by-source");
const glossaryPath = resolve(root, "translations/glossary");
const outputPath = resolve(root, "translations/gen/common-sequences.json");
const strings = new Set<string>();
const glossary = new Set<string>();

for (const file of readdirSync(catalogsPath).filter(file => file.endsWith(".json"))) {
  const values = await Bun.file(resolve(catalogsPath, file)).json() as Record<string, string>;
  for (const chinese of Object.keys(values)) strings.add(chinese);
}
for (const file of readdirSync(glossaryPath).filter(file => file.endsWith(".json"))) {
  const values = await Bun.file(resolve(glossaryPath, file)).json() as Record<string, string>;
  for (const chinese of Object.keys(values)) glossary.add(chinese);
}

type Hit = { occurrences: number; strings: number; examples: string[] };
const report: Record<string, Array<{ text: string; occurrences: number; strings: number; examples: string[]; glossary: boolean }>> = {};

for (const size of [2, 3, 4]) {
  const hits = new Map<string, Hit>();
  for (const source of strings) {
    const seen = new Set<string>();
    for (const run of source.match(/[\u3400-\u9fff]+/g) ?? []) {
      for (let index = 0; index <= run.length - size; index++) {
        const text = run.slice(index, index + size);
        const hit = hits.get(text) ?? { occurrences: 0, strings: 0, examples: [] };
        hit.occurrences++;
        if (!seen.has(text)) {
          hit.strings++;
          seen.add(text);
          if (hit.examples.length < 3) hit.examples.push(source);
        }
        hits.set(text, hit);
      }
    }
  }

  report[String(size)] = [...hits]
    .filter(([, hit]) => hit.strings >= 2)
    .sort((a, b) => b[1].strings - a[1].strings || b[1].occurrences - a[1].occurrences || a[0].localeCompare(b[0], "zh"))
    .map(([text, hit]) => ({ text, ...hit, glossary: glossary.has(text) }));
}

await Bun.write(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Wrote ${Object.values(report).reduce((sum, rows) => sum + rows.length, 0)} repeated Chinese sequences to translations/gen/common-sequences.json.`);
