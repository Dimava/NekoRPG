import * as parse5 from "parse5";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourcePath = resolve(root, "index.html");
const outputPath = resolve(root, "en.html");
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

await Bun.write(outputPath, output);

const relativeCatalog = catalogPath.slice(root.length + 1).replaceAll("\\", "/");
console.log(`Generated en.html using ${relativeCatalog}.`);
console.log(`Translated ${translated} visible HTML runs; ${missing.size} distinct Chinese runs remain.`);
if (missing.size) {
  console.log("Untranslated runs:");
  for (const value of [...missing].sort((a, b) => a.localeCompare(b, "zh"))) {
    console.log(`  ${JSON.stringify(value)}`);
  }
}
