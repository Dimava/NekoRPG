import * as parse5 from "parse5";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourcePath = resolve(root, "index.html");
const outputPath = resolve(root, "en.html");
const browserCatalogPath = resolve(root, "translations/en.full.js");
const catalogCandidates = [
  resolve(root, "tl/en.full.json"),
  resolve(root, "translations/en.full.json"),
];
const catalogPath = catalogCandidates.find(existsSync);

if (!catalogPath) {
  throw new Error("Translation catalog not found (expected tl/en.full.json or translations/en.full.json)");
}

const source = await Bun.file(sourcePath).text();
const catalog = await Bun.file(catalogPath).json() as Record<string, string>;
const document = parse5.parse(source, { sourceCodeLocationInfo: true }) as any;
const han = /[\u3400-\u9fff]/;
const visibleAttributes = new Set(["alt", "placeholder", "title", "value"]);
const skippedElements = new Set(["script", "style"]);

type Edit = { start: number; end: number; replacement: string };
const edits: Edit[] = [];
const missing = new Set<string>();
let translated = 0;

function addEdit(start: number, end: number, original: string) {
  const replacement = catalog[original];
  if (replacement === undefined || replacement === original) {
    missing.add(original);
    return;
  }
  edits.push({ start, end, replacement });
  translated++;
}

function walk(node: any) {
  if (node.nodeName === "#text") {
    const value = node.value.trim();
    if (!value || !han.test(value) || !node.sourceCodeLocation) return;

    const { startOffset, endOffset } = node.sourceCodeLocation;
    const raw = source.slice(startOffset, endOffset);
    const relativeStart = raw.indexOf(value);
    if (relativeStart === -1) {
      missing.add(value);
      return;
    }
    addEdit(startOffset + relativeStart, startOffset + relativeStart + value.length, value);
    return;
  }

  if (skippedElements.has(node.nodeName)) return;

  // A sentence split across <b> and <span> cannot be reordered one text node at
  // a time, so an element with an id may have its whole contents replaced by a
  // "#id" entry instead.
  const id = node.attrs?.find((attribute: any) => attribute.name === "id")?.value;
  const block = id === undefined ? undefined : catalog[`#${id}`];
  const startTag = node.sourceCodeLocation?.startTag;
  const endTag = node.sourceCodeLocation?.endTag;
  if (block !== undefined && startTag && endTag) {
    edits.push({ start: startTag.endOffset, end: endTag.startOffset, replacement: block });
    translated++;
    return;
  }

  for (const attribute of node.attrs ?? []) {
    if (!visibleAttributes.has(attribute.name) || !han.test(attribute.value)) continue;
    const location = node.sourceCodeLocation?.attrs?.[attribute.name];
    if (!location) {
      missing.add(attribute.value);
      continue;
    }
    const raw = source.slice(location.startOffset, location.endOffset);
    const relativeStart = raw.indexOf(attribute.value);
    if (relativeStart === -1) {
      missing.add(attribute.value);
      continue;
    }
    addEdit(
      location.startOffset + relativeStart,
      location.startOffset + relativeStart + attribute.value.length,
      attribute.value,
    );
  }

  for (const child of node.childNodes ?? []) walk(child);
}

walk(document);

// Apply edits backwards so source offsets remain valid.
edits.sort((left, right) => right.start - left.start);
let output = source;
for (const edit of edits) {
  output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
}

// Give browsers and assistive technology the correct document language.
output = output.replace(/<html(?=\s|>)/i, '$& lang="en"');

// The classic script loads synchronously before the game module. Keeping the
// generated catalog out of the module graph lets index.html run without it.
const gameModule = /(<script\s+type\s*=\s*["']module["']\s+src\s*=\s*["']src\/main\.js["'][^>]*>\s*<\/script>)/i;
if (!gameModule.test(output)) throw new Error("Could not find the src/main.js module script in index.html");
output = output.replace(gameModule, '<script src="translations/en.full.js"></script>\n        $1');

await Bun.write(
  browserCatalogPath,
  `globalThis.NekoRPGTranslations = ${JSON.stringify(catalog)};\n`,
);
await Bun.write(outputPath, output);

const relativeCatalog = catalogPath.slice(root.length + 1).replaceAll("\\", "/");
console.log(`Generated en.html using ${relativeCatalog}.`);
console.log("Generated translations/en.full.js for browser use.");
console.log(`Translated ${translated} visible HTML runs; ${missing.size} distinct Chinese runs remain.`);
if (missing.size) {
  console.log("Untranslated runs:");
  for (const value of [...missing].sort((a, b) => a.localeCompare(b, "zh"))) {
    console.log(`  ${JSON.stringify(value)}`);
  }
}
