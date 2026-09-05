import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { basename, resolve } from "node:path";
import { collectHtml, collectJs, han } from "./collect.ts";

const root = resolve(import.meta.dir, "..");
const catalogPath = resolve(root, "translations/source/catalog.raw.json");
const output = resolve(root, "translations/gen/by-source");
const catalog = await Bun.file(catalogPath).json() as Record<string, string>;

function sourceCatalog(values: Map<string, string>) {
  const unique = new Set([...values.values()].filter(value => han.test(value)));
  return Object.fromEntries([...unique]
    .sort((a, b) => a.localeCompare(b, "zh"))
    .map(chinese => [chinese, catalog[chinese] ?? "<?>"]));
}

mkdirSync(output, { recursive: true });
const written = new Set<string>();
let writtenSourceFiles = 0;

for (const file of readdirSync(resolve(root, "src")).filter(file => file.endsWith(".js"))) {
  const name = basename(file, ".js") + ".json";
  const source = await Bun.file(resolve(root, "src", file)).text();
  const values = sourceCatalog(collectJs(source));
  if (!Object.keys(values).length) continue;
  await Bun.write(resolve(output, name), JSON.stringify(values, null, 2) + "\n");
  written.add(name);
  writtenSourceFiles++;
}

const htmlValues = new Map<string, string>();
for (const file of readdirSync(root).filter(file => file.endsWith(".html") && file !== "en.html")) {
  const source = await Bun.file(resolve(root, file)).text();
  for (const [path, value] of collectHtml(source)) htmlValues.set(`${file}:${path}`, value);
}
await Bun.write(resolve(output, "html.json"), JSON.stringify(sourceCatalog(htmlValues), null, 2) + "\n");
written.add("html.json");

for (const name of readdirSync(output).filter(name => name.endsWith(".json") && !written.has(name))) {
  unlinkSync(resolve(output, name));
}

await Bun.write(resolve(root, "translations/gen/README.md"),
  "# Generated files\n\nEverything in this directory is generated. Do not edit it by hand.\n\nRegenerate with `bun run compile`.\n");

console.log(`Split the catalog over ${writtenSourceFiles} JavaScript catalogs and one HTML catalog in translations/gen/by-source.`);
