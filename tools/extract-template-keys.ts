// Collects every t`...` display template in src/ and records it in the glossary
// under a placeholder-agnostic key, so the translation survives a variable
// rename inside the template.
//
// English is only ever reused, never invented: a template is emitted when the
// compiled catalog, or this file's own previous contents, already holds an
// entry whose literal parts are identical. Templates without one are reported
// and left for a human.
//
// Entries already in the output win over the catalog, and are only dropped when
// their template disappears from src/. The compiled catalog is gitignored, so
// without that a fresh clone would empty this file on its first run.
import { parse } from "acorn";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const sourceDir = resolve(root, "src");
const compiledCatalogPath = resolve(root, "translations/en.full.json");
const handcraftedPath = resolve(root, "translations/glossary");
const outputPath = resolve(handcraftedPath, "templates.json");
const han = /[\u3400-\u9fff]/;
const PLACEHOLDER = "{{}}";

// Mirrors split_placeholders in src/i18n.js.
function splitPlaceholders(text: string) {
  const parts: string[] = [];
  let literal = "";
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith(PLACEHOLDER, i)) {
      parts.push(literal);
      literal = "";
      i += PLACEHOLDER.length - 1;
      continue;
    }
    if (text[i] === "$" && text[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      if (depth > 0) break;
      parts.push(literal);
      literal = "";
      i = j - 1;
      continue;
    }
    literal += text[i];
  }
  parts.push(literal);
  return parts;
}

function taggedTemplates(source: string) {
  const found: string[] = [];
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" }) as any;
  (function walk(node: any) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "TaggedTemplateExpression" && node.tag?.type === "Identifier" && node.tag.name === "t") {
      const raw = source.slice(node.quasi.start + 1, node.quasi.end - 1);
      if (han.test(raw)) found.push(raw);
    }
    for (const [key, child] of Object.entries(node)) {
      if (["start", "end", "loc", "range"].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(walk);
      else walk(child);
    }
  })(ast);
  return found;
}

// Reads the catalog from the previous run: this writes a glossary input, so it
// cannot wait for the compile step that consumes it.
const compiledCatalog = Bun.file(compiledCatalogPath);
const catalog = await compiledCatalog.exists()
  ? await compiledCatalog.json() as Record<string, string>
  : {};

// Index the compiled catalog by literal parts, so an entry extracted from the
// source as `${expression}` can answer for the same template written as `{{}}`.
const byParts = new Map<string, string>();
for (const [chinese, english] of Object.entries(catalog)) {
  if (typeof english !== "string" || english === chinese) continue;
  const chineseParts = splitPlaceholders(chinese);
  const englishParts = splitPlaceholders(english);
  if (chineseParts.length !== englishParts.length) continue;
  byParts.set(chineseParts.join(PLACEHOLDER), englishParts.join(PLACEHOLDER));
}

const templates = new Set<string>();
for (const file of readdirSync(sourceDir).filter(name => name.endsWith(".js"))) {
  const source = await Bun.file(resolve(sourceDir, file)).text();
  for (const template of taggedTemplates(source)) {
    templates.add(splitPlaceholders(template).join(PLACEHOLDER));
  }
}

const existingFile = Bun.file(outputPath);
const existing = await existingFile.exists()
  ? await existingFile.json() as Record<string, string>
  : {};

// A placeholder-free template is an ordinary string, so another glossary file
// may already define it. The loader rejects a key defined twice.
const claimed = new Set<string>();
for (const file of readdirSync(handcraftedPath).filter(name => name.endsWith(".json") && resolve(handcraftedPath, name) !== outputPath)) {
  const values = await Bun.file(resolve(handcraftedPath, file)).json() as Record<string, string>;
  for (const key of Object.keys(values)) claimed.add(key);
}

const resolved: Record<string, string> = {};
const missing: string[] = [];
const partial: string[] = [];
for (const key of [...templates].sort((a, b) => a.localeCompare(b, "zh"))) {
  if (claimed.has(key)) continue;
  const english = existing[key] ?? byParts.get(key);
  if (english === undefined) {
    missing.push(key);
    continue;
  }
  resolved[key] = english;
  if (han.test(english)) partial.push(key);
}

await Bun.write(outputPath, JSON.stringify(resolved, null, 2) + "\n");

const dropped = Object.keys(existing).filter(key => !templates.has(key));

console.log(`Found ${templates.size} display templates in src/.`);
console.log(`Reused ${Object.keys(resolved).length} existing translations in translations/glossary/templates.json.`);
if (dropped.length) {
  console.log(`${dropped.length} no longer appear in src/ and were dropped:`);
  for (const key of dropped) console.log(`  ${JSON.stringify(key)}`);
}
if (partial.length) {
  console.log(`${partial.length} reuse an entry that is still partly Chinese:`);
  for (const key of partial) console.log(`  ${JSON.stringify(key)}`);
}
if (missing.length) {
  console.log(`${missing.length} have no catalog entry and need translating by hand:`);
  for (const key of missing) console.log(`  ${JSON.stringify(key)}`);
}
