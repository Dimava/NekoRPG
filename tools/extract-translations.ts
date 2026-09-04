import { parse } from "acorn";
import * as parse5 from "parse5";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const left = process.argv[2] ?? "maxrau/main";
const right = process.argv[3] ?? "maxrau/english";
const output = resolve(root, process.argv[4] ?? "translations/gen/catalog.raw.json");
const splitOutput = resolve(root, "translations/gen/by-source");
const han = /[\u3400-\u9fff]/;

function git(...args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout.toString();
}

function fileAt(revision: string, file: string) {
  const result = Bun.spawnSync(["git", "show", `${revision}:${file}`], { cwd: root });
  return result.exitCode === 0 ? result.stdout.toString() : null;
}

function collectJs(source: string) {
  const values = new Map<string, string>();
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" }) as any;

  function walk(node: any, path: string) {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Literal" && typeof node.value === "string") values.set(path, node.value);
    if (node.type === "TemplateLiteral") values.set(path, source.slice(node.start + 1, node.end - 1));

    for (const [key, child] of Object.entries(node)) {
      if (["start", "end", "loc", "range"].includes(key)) continue;
      if (Array.isArray(child)) {
        child.forEach((item, index) => walk(item, `${path}.${key}[${index}]`));
      } else {
        walk(child, `${path}.${key}`);
      }
    }
  }

  walk(ast, "root");
  return values;
}

function collectHtml(source: string) {
  const values = new Map<string, string>();
  const document = parse5.parse(source) as any;
  const translatedAttributes = new Set(["title", "placeholder", "value", "alt"]);

  function walk(node: any, path: string) {
    if (node.nodeName === "#text") {
      const value = node.value.trim();
      if (value) values.set(`${path}.text`, value);
      return;
    }
    if (node.nodeName === "script" || node.nodeName === "style") return;
    for (const attribute of node.attrs ?? []) {
      if (translatedAttributes.has(attribute.name)) {
        values.set(`${path}.attr.${attribute.name}`, attribute.value);
      }
    }
    (node.childNodes ?? []).forEach((child: any, index: number) => {
      walk(child, `${path}.${child.nodeName}[${index}]`);
    });
  }

  walk(document, "root");
  return values;
}

const base = git("merge-base", left, right).trim();
const files = git("diff", "--name-only", `${base}..${right}`, "--", "*.js", "*.html")
  .trim().split(/\r?\n/).filter(Boolean);
const catalog = new Map<string, string>();
const conflicts = new Map<string, Set<string>>();

for (const file of files) {
  const before = fileAt(base, file);
  const after = fileAt(right, file);
  if (before === null || after === null) continue;

  let oldValues: Map<string, string>;
  let newValues: Map<string, string>;
  try {
    const collect = file.endsWith(".html") ? collectHtml : collectJs;
    oldValues = collect(before);
    newValues = collect(after);
  } catch (error) {
    console.warn(`Skipped ${file}: ${error}`);
    continue;
  }

  for (const [path, chinese] of oldValues) {
    const english = newValues.get(path);
    if (!han.test(chinese) || english === undefined || chinese === english) continue;
    const previous = catalog.get(chinese);
    if (previous && previous !== english) {
      const options = conflicts.get(chinese) ?? new Set([previous]);
      options.add(english);
      conflicts.set(chinese, options);
      continue;
    }
    catalog.set(chinese, english);
  }
}

const sorted = Object.fromEntries([...catalog].sort(([a], [b]) => a.localeCompare(b, "zh")));
mkdirSync(dirname(output), { recursive: true });
await Bun.write(output, JSON.stringify(sorted, null, 2) + "\n");

function sourceCatalog(values: Map<string, string>) {
  const unique = new Set([...values.values()].filter(value => han.test(value)));
  return Object.fromEntries([...unique]
    .sort((a, b) => a.localeCompare(b, "zh"))
    .map(chinese => [chinese, catalog.get(chinese) ?? "<?>"]));
}

mkdirSync(splitOutput, { recursive: true });

const sourceFiles = git("ls-tree", "-r", "--name-only", base)
  .trim().split(/\r?\n/).filter(file => /^src\/[^/]+\.js$/.test(file));
let writtenSourceFiles = 0;
const writtenNames = new Set<string>();
for (const file of sourceFiles) {
  const source = fileAt(base, file);
  if (source === null) continue;
  const name = basename(file, ".js") + ".json";
  const values = sourceCatalog(collectJs(source));
  if (Object.keys(values).length) {
    await Bun.write(resolve(splitOutput, name), JSON.stringify(values, null, 2) + "\n");
    writtenSourceFiles++;
    writtenNames.add(name);
  }
}

const htmlValues = new Map<string, string>();
const htmlFiles = git("ls-tree", "-r", "--name-only", base)
  .trim().split(/\r?\n/).filter(file => !file.includes("/") && file.endsWith(".html"));
for (const file of htmlFiles) {
  const source = fileAt(base, file);
  if (source === null) continue;
  for (const [path, value] of collectHtml(source)) htmlValues.set(`${file}:${path}`, value);
}
await Bun.write(resolve(splitOutput, "html.json"), JSON.stringify(sourceCatalog(htmlValues), null, 2) + "\n");
writtenNames.add("html.json");
for (const name of readdirSync(splitOutput).filter(name => name.endsWith(".json") && !writtenNames.has(name))) {
  unlinkSync(resolve(splitOutput, name));
}

console.log(`Extracted ${catalog.size} translations from ${files.length} changed files.`);
console.log(`Wrote ${output.slice(root.length + 1)}.`);
await Bun.write(resolve(root, "translations/gen/README.md"),
  "# Generated files\n\nEverything in this directory is generated. Do not edit it by hand.\n\nRegenerate with `bun run --cwd tools extract-translations`.\n");

console.log(`Wrote ${writtenSourceFiles} non-empty JavaScript catalogs and one HTML catalog to translations/gen/by-source.`);
if (conflicts.size) console.warn(`${conflicts.size} Chinese strings had conflicting translations; kept the first.`);
