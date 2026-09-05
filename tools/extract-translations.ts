import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectHtml, collectJs, han } from "./collect.ts";

const root = resolve(import.meta.dir, "..");
const left = process.argv[2] ?? "maxrau/main";
const right = process.argv[3] ?? "maxrau/english";
const output = resolve(root, process.argv[4] ?? "translations/source/catalog.raw.json");

function git(...args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim());
  return result.stdout.toString();
}

function fileAt(revision: string, file: string) {
  const result = Bun.spawnSync(["git", "show", `${revision}:${file}`], { cwd: root });
  return result.exitCode === 0 ? result.stdout.toString() : null;
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

console.log(`Extracted ${catalog.size} translations from ${files.length} changed files.`);
console.log(`Wrote ${output.slice(root.length + 1)}.`);
await Bun.write(resolve(root, "translations/source/README.md"),
  "# Extraction source\n\n`catalog.raw.json` is extracted from the `maxrau/main..maxrau/english` diff and\ncommitted, so `bun run compile` never needs those branches. Refresh it with\n`bun run --cwd tools extract-translations` from a clone that has the maxrau\nremote. Everything else is generated into `translations/gen/`.\n");
if (conflicts.size) console.warn(`${conflicts.size} Chinese strings had conflicting translations; kept the first.`);
