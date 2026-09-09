// One-off merge of dragonayzer's "NekoRPG Game Text Localizer" userscript
// (v16.7) into translations/glossary/*.json.
//
//   bun run tools/merge-userscript.ts <userscript.js> [--apply]
//
// Without --apply it only analyses: per-layer overlap counts against the
// glossary, the extraction catalog and the compiled catalog, plus detail dumps
// in .tmp/merge/. With --apply it writes the accepted additions into the
// glossary files. The rules are written up in docs/translation-merge.md.
//
// The userscript keys on trimmed DOM text nodes. Our keys are the source
// literals. The two agree for names, labels, `<br>`-free prose and for `${}`
// templates (the userscript keeps the source expression in its fragment
// keys), so the merge only accepts a userscript key that maps onto a string
// that actually exists in src/ or index.html, or onto a `{{}}` skeleton that
// templates.json already lists.
import { parse } from "acorn";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const userscriptPath = args.find(a => !a.startsWith("--"));
if (!userscriptPath) throw new Error("usage: bun run tools/merge-userscript.ts <userscript.js> [--apply]");
const dumpDir = resolve(root, ".tmp/merge");
mkdirSync(dumpDir, { recursive: true });

const han = /[㐀-鿿]/;
const PLACEHOLDER = "{{}}";

// ---------------------------------------------------------------- userscript

const source = (await Bun.file(userscriptPath).text()).replace(/\r\n/g, "\n");
const ast = parse(source, { ecmaVersion: "latest", sourceType: "script" }) as any;
const tables: Record<string, any> = {};

function literal(node: any): any {
  switch (node.type) {
    case "Literal":
      return node.regex ? new RegExp(node.regex.pattern, node.regex.flags) : node.value;
    case "TemplateLiteral":
      if (node.expressions.length) throw new Error("template with expressions");
      return node.quasis[0].value.cooked;
    case "UnaryExpression":
      return node.operator === "-" ? -literal(node.argument) : literal(node.argument);
    case "ObjectExpression": {
      const object: Record<string, any> = {};
      for (const property of node.properties) {
        const key = property.key.type === "Literal" ? String(property.key.value) : property.key.name;
        object[key] = literal(property.value);
      }
      return object;
    }
    case "ArrayExpression":
      return node.elements.flatMap((element: any) => {
        // `...statPairs` inside the buttons map: tables are declared before use.
        if (element.type === "SpreadElement") {
          const name = element.argument.name;
          if (!(name in tables)) throw new Error(`spread of unknown table ${name}`);
          return tables[name];
        }
        return [literal(element)];
      });
    case "CallExpression": {
      const callee = node.callee;
      // [...].map(r => ...) : take the array as written.
      if (callee.type === "MemberExpression" && callee.object.type === "ArrayExpression") return literal(callee.object);
      // Object.assign(Object.create(null), {...}) : take the object literal.
      if (callee.type === "MemberExpression" && callee.object.name === "Object" && callee.property.name === "assign") {
        return literal(node.arguments[node.arguments.length - 1]);
      }
      throw new Error(`unsupported call ${source.slice(node.start, node.start + 60)}`);
    }
    case "NewExpression":
      if (node.callee.name === "Set") return literal(node.arguments[0]);
      throw new Error("unsupported new");
    default:
      throw new Error(`unsupported node ${node.type} at ${node.start}`);
  }
}

const wanted = new Set(["itemNames", "componentPairs", "statPairs", "realmPairs", "slotPairs", "buttons",
  "proseExact", "proseFrag", "proseRegex", "bestiaryNames", "partTiers", "REALM_TIERS", "REST_LOCATIONS", "BACKWARD_LABELS"]);
(function walk(node: any) {
  if (!node || typeof node.type !== "string") return;
  if (node.type === "VariableDeclarator" && node.id?.type === "Identifier" && wanted.has(node.id.name) && node.init) {
    tables[node.id.name] = literal(node.init);
  }
  for (const [key, child] of Object.entries(node)) {
    if (["start", "end", "loc", "range"].includes(key)) continue;
    if (Array.isArray(child)) child.forEach(walk);
    else if (child && typeof child === "object") walk(child);
  }
})(ast);
for (const name of wanted) if (!(name in tables)) throw new Error(`table ${name} not found`);

// A layer is a flat Chinese -> English map. The pair arrays and the
// per-selector button map flatten to that; bestiaryNames is inverted; the
// regex layer is converted to {{}} skeletons below. Layer order is the
// priority when two layers translate the same key differently.
type Layer = { name: string; entries: Map<string, string> };
const layers: Layer[] = [];
function addLayer(name: string, pairs: Iterable<[string, string]>) {
  const entries = new Map<string, string>();
  for (const [zh, en] of pairs) if (!entries.has(zh)) entries.set(zh, en);
  layers.push({ name, entries });
  return entries;
}
addLayer("itemNames", Object.entries(tables.itemNames));
addLayer("bestiaryNames", Object.entries(tables.bestiaryNames as Record<string, string>).map(([en, zh]) => [zh, en] as [string, string]));
addLayer("proseExact", Object.entries(tables.proseExact));
addLayer("componentPairs", tables.componentPairs);
addLayer("statPairs", tables.statPairs);
addLayer("realmPairs", tables.realmPairs);
addLayer("slotPairs", tables.slotPairs);
addLayer("buttons", Object.values(tables.buttons as Record<string, [string, string][]>).flat());
addLayer("proseFrag", Object.entries(tables.proseFrag));

// ---------------------------------------------------------------- our side

const glossaryDir = resolve(root, "translations/glossary");
const glossaryFiles = readdirSync(glossaryDir).filter(f => f.endsWith(".json")).sort();
const glossary = new Map<string, { english: string; file: string }>();
const glossaryData: Record<string, Record<string, string>> = {};
for (const file of glossaryFiles) {
  const values = await Bun.file(resolve(glossaryDir, file)).json() as Record<string, string>;
  glossaryData[file] = values;
  for (const [zh, en] of Object.entries(values)) glossary.set(zh, { english: en, file });
}
const rawCatalog = await Bun.file(resolve(root, "translations/source/catalog.raw.json")).json() as Record<string, string>;
const compiled = await Bun.file(resolve(root, "translations/en.full.json")).json() as Record<string, string>;

// Every Chinese literal in src/ and index.html, as split-catalog wrote it.
const bySourceDir = resolve(root, "translations/gen/by-source");
const sourceKeys = new Map<string, Set<string>>();
for (const file of readdirSync(bySourceDir).filter(f => f.endsWith(".json"))) {
  const values = await Bun.file(resolve(bySourceDir, file)).json() as Record<string, string>;
  for (const key of Object.keys(values)) {
    if (!sourceKeys.has(key)) sourceKeys.set(key, new Set());
    sourceKeys.get(key)!.add(file.replace(/\.json$/, ""));
  }
}

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
const skeleton = (text: string) => splitPlaceholders(text).join(PLACEHOLDER);

// The DOM node the userscript saw is the source literal with its outer
// wrapper tags removed, trimmed.
function unwrapOuter(value: string) {
  value = value.trim().replace(/^(?:<br\s*\/?>)+/i, "").replace(/(?:<br\s*\/?>)+$/i, "").trim();
  for (;;) {
    const m = value.match(/^<([A-Za-z][\w:-]*)\b[^>]*>([\s\S]*)<\/\1>$/);
    if (!m || m[2].includes(`</${m[1]}>`)) break;
    value = m[2].trim();
  }
  return value;
}

// Indexes from what the userscript would have seen back to the source key.
const trimmedIndex = new Map<string, string>();
const unwrappedIndex = new Map<string, string>();
const brLines = new Map<string, string>();       // one <br> line -> the source key it belongs to
const sourceSkeletons = new Map<string, string>();
for (const key of sourceKeys.keys()) {
  const trimmed = key.trim();
  if (!trimmedIndex.has(trimmed)) trimmedIndex.set(trimmed, key);
  const unwrapped = unwrapOuter(key);
  if (!unwrappedIndex.has(unwrapped)) unwrappedIndex.set(unwrapped, key);
  if (/<br\s*\/?>/i.test(unwrapped)) {
    for (const line of unwrapped.split(/<br\s*\/?>/i)) {
      const l = line.trim();
      if (l && han.test(l) && !brLines.has(l)) brLines.set(l, key);
    }
  }
  if (key.includes("${")) {
    const s = skeleton(trimmed);
    if (!sourceSkeletons.has(s)) sourceSkeletons.set(s, key);
  }
}
const templateKeys = new Set(Object.keys(glossaryData["templates.json"]));

// State of a string on our side.
type State = "glossary" | "translated" | "partial" | "untranslated";
function stateOf(key: string): State {
  if (glossary.has(key)) {
    const english = glossary.get(key)!.english;
    // A {{中文|English}} reference is resolved by compile; it is not residue.
    const resolved = english.replace(/\{\{[^|}]*\|[^}]*\}\}/g, "");
    return english === "<!>" || english === "<?>" ? "untranslated" : han.test(resolved) ? "partial" : "glossary";
  }
  const english = compiled[key];
  if (english === undefined || english === key) return "untranslated";
  if (han.test(english)) return "partial";
  return "translated";
}
function oursFor(key: string): { english: string; from: string } | undefined {
  if (glossary.has(key)) return { english: glossary.get(key)!.english, from: glossary.get(key)!.file };
  const english = compiled[key];
  if (english === undefined || english === key) return undefined;
  return { english, from: rawCatalog[key] !== undefined ? "catalog.raw" : "compiled" };
}
function normalizeEnglish(value: string) {
  return value.replace(/\{\{[^|}]*\|([^}]*)\}\}/g, "$1").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/\s+/g, " ").replace(/\s*([·:;,.!?])\s*/g, "$1").trim().toLowerCase();
}

// ------------------------------------------------ regex and template layers

// Anchored regexes whose captures are plain wildcards and whose replacement
// uses $1..$n once each, in order, become {{}} skeletons. The rest are skipped.
const regexSkeletons = new Map<string, { english: string; pattern: string }>();
const regexSkipped: { pattern: string; reason: string }[] = [];
for (const [pattern, replacement] of tables.proseRegex as [string, string, string][]) {
  let p = pattern;
  if (!p.startsWith("^") || !p.endsWith("$")) { regexSkipped.push({ pattern, reason: "unanchored" }); continue; }
  p = p.slice(1, -1);
  let captures = 0;
  p = p.replace(/\((?:\.\+\?|\.\*\?|\.\+|\.\*|\[\\d\.,\]\+|\[\\d\.,\]\+\?|\[\^\]]\+|\[\\s\\S\]\*\?)\)/g, () => { captures++; return " "; });
  if (!captures) { regexSkipped.push({ pattern, reason: "no capture" }); continue; }
  if (/(?<!\\)[()[\]|*+?]/.test(p)) { regexSkipped.push({ pattern, reason: "regex syntax left after captures" }); continue; }
  p = p.replace(/\\(.)/g, "$1");
  const zh = p.replace(/ /g, PLACEHOLDER);
  const refs = [...replacement.matchAll(/\$(\d)/g)].map(m => Number(m[1]));
  if (refs.length !== captures) { regexSkipped.push({ pattern, reason: "capture count mismatch" }); continue; }
  if (!refs.every((n, i) => n === i + 1)) { regexSkipped.push({ pattern, reason: "reordered captures" }); continue; }
  if (!han.test(zh)) { regexSkipped.push({ pattern, reason: "no Han in skeleton" }); continue; }
  const en = replacement.replace(/\$\d/g, PLACEHOLDER);
  if (!regexSkeletons.has(zh)) regexSkeletons.set(zh, { english: en, pattern });
}
addLayer("proseRegex", [...regexSkeletons].map(([zh, v]) => [zh, v.english] as [string, string]));

// proseFrag entries written with the source `${}` expressions are templates.
const fragTemplates = new Map<string, { english: string; userKey: string }>();
const fragTemplateSkipped: { key: string; reason: string }[] = [];
for (const [zh, en] of layers.find(l => l.name === "proseFrag")!.entries) {
  if (!zh.includes("${")) continue;
  const zhParts = splitPlaceholders(zh.trim());
  const enParts = splitPlaceholders(en.trim());
  if (zhParts.length !== enParts.length) { fragTemplateSkipped.push({ key: zh, reason: "placeholder count differs" }); continue; }
  // The English must keep the same expressions in the same order.
  const zhOnly = zh.trim(), enOnly = en.trim();
  const zhExpr: string[] = [], enExpr: string[] = [];
  for (const [text, out] of [[zhOnly, zhExpr], [enOnly, enExpr]] as const) {
    let i = 0;
    for (const part of splitPlaceholders(text).slice(0, -1)) {
      i = text.indexOf("${", i + part.length);
      let depth = 1, j = i + 2;
      while (j < text.length && depth > 0) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
      out.push(text.slice(i, j));
      i = j;
    }
  }
  if (zhExpr.join("\n") !== enExpr.join("\n")) { fragTemplateSkipped.push({ key: zh, reason: "expressions differ or reordered" }); continue; }
  const s = zhParts.join(PLACEHOLDER);
  if (!han.test(s)) continue;
  if (!fragTemplates.has(s)) fragTemplates.set(s, { english: enParts.join(PLACEHOLDER), userKey: zh });
}
// A label followed (or preceded) by one interpolation renders as its own DOM
// node with the value in another, so the userscript keyed the bare label.
function affixTemplate(s: string) {
  const tail = s.match(/^(.*?)(\s*)\{\{\}\}$/s);
  const head = s.match(/^\{\{\}\}(\s*)(.*)$/s);
  const [literal, before, after] = tail ? [tail[1], "", tail[2] + PLACEHOLDER] : head ? [head[2], PLACEHOLDER + head[1], ""] : [];
  if (literal === undefined || literal.includes(PLACEHOLDER) || !han.test(literal)) return undefined;
  const hit = exactLookup.get(literal.trim());
  if (!hit || han.test(hit.english)) return undefined;
  return { english: before + literal.replace(literal.trim(), hit.english) + after, userKey: literal.trim(), layer: hit.layer };
}
const templateLookup = (s: string) =>
  fragTemplates.has(s) ? { english: fragTemplates.get(s)!.english, userKey: fragTemplates.get(s)!.userKey, layer: "proseFrag" }
  : regexSkeletons.has(s) ? { english: regexSkeletons.get(s)!.english, userKey: regexSkeletons.get(s)!.pattern, layer: "proseRegex" }
  : affixTemplate(s);

// ---------------------------------------------------------------- per-layer coverage

// Each layer measured on its own: does the key name a string in src/, and
// what do we have for it. Used for the assessment table.
type Coverage = { total: number; inSource: number; same: number; different: number; fills: number; unmatched: number };
const coverage = new Map<string, Coverage>();
function resolveUserKey(key: string) {
  if (sourceKeys.has(key)) return key;
  return trimmedIndex.get(key) ?? unwrappedIndex.get(key) ?? brLines.get(key)
    ?? (key.includes("${") ? sourceSkeletons.get(skeleton(key.trim())) : undefined);
}
for (const layer of layers) {
  const c: Coverage = { total: layer.entries.size, inSource: 0, same: 0, different: 0, fills: 0, unmatched: 0 };
  for (const [zh, en] of layer.entries) {
    let sourceKey = resolveUserKey(zh);
    let ours: { english: string; from: string } | undefined;
    let state: State | undefined;
    if (layer.name === "proseRegex") {
      if (templateKeys.has(zh)) { sourceKey = zh; ours = { english: glossaryData["templates.json"][zh], from: "templates.json" }; }
      else if (sourceSkeletons.has(zh)) { sourceKey = sourceSkeletons.get(zh)!; }
      if (sourceKey && !ours) { const o = oursFor(sourceKey); ours = o && { english: skeleton(o.english.trim()), from: o.from }; }
      if (ours) state = ours.english === "<!>" ? "untranslated" : han.test(ours.english) ? "partial" : ours.from.endsWith(".json") ? "glossary" : "translated";
      else state = sourceKey ? "untranslated" : undefined;
    } else if (sourceKey) {
      state = stateOf(sourceKey);
      ours = oursFor(sourceKey);
      // A <br> line is compared against nothing: the whole string is what we hold.
      if (brLines.get(zh) === sourceKey && !sourceKeys.has(zh)) ours = undefined;
    }
    if (!sourceKey) { c.unmatched++; continue; }
    c.inSource++;
    if (state === "untranslated" || state === "partial") c.fills++;
    else if (ours && normalizeEnglish(ours.english) === normalizeEnglish(en)) c.same++;
    else c.different++;
  }
  coverage.set(layer.name, c);
}

// ---------------------------------------------------------------- matching for the merge

type Match = {
  layer: string;
  userKey: string;
  english: string;          // userscript English, {{}} for templates
  sourceKey: string;        // the glossary key we would write
  via: "exact" | "unwrapped" | "br-join" | "template";
  state: State;
  ours?: string;
  oursFrom?: string;
};

const exactLookup = new Map<string, { english: string; layer: string }>();
for (const layer of layers) {
  if (layer.name === "proseRegex") continue;
  for (const [zh, en] of layer.entries) if (!exactLookup.has(zh)) exactLookup.set(zh, { english: en, layer: layer.name });
}

const brJoinMisaligned: string[] = [];
function endingsAlign(zh: string, en: string) {
  const closers = /[)）\]】」』”"'》]+$/;
  const z = zh.replace(closers, "");
  const e = en.replace(closers, "").trimEnd();
  const zhTerminal = /[。！？…～~]$/.test(z);
  const enTerminal = /[.!?…~]$/.test(e);
  const zhPause = /[，、；：]$/.test(z);
  const enPause = /[,;:]$/.test(e);
  const zhDash = /[—–-]$/.test(z);
  const enDash = /[—–-]$/.test(e);
  if (zhTerminal && !enTerminal) return false;
  if (zhPause && !enPause && !enDash) return false;
  if (zhDash && !enDash && !enTerminal) return false;
  if (!zhTerminal && !zhPause && !zhDash && (enPause || enDash)) return false;
  if (/^\[[^\]]+\]/.test(zh) !== /^\[[^\]]+\]/.test(en)) return false;
  return true;
}

const matches: Match[] = [];
const claimed = new Set<string>();
function record(m: Match) {
  if (claimed.has(m.sourceKey)) return;
  claimed.add(m.sourceKey);
  matches.push(m);
}

for (const key of sourceKeys.keys()) {
  const state = stateOf(key);
  const ours = oursFor(key);
  const base = { state, ours: ours?.english, oursFrom: ours?.from };
  const trimmed = key.trim();
  const direct = exactLookup.get(key) ?? exactLookup.get(trimmed);
  if (direct) { record({ layer: direct.layer, userKey: trimmed, english: direct.english, sourceKey: key, via: "exact", ...base }); continue; }
  const unwrapped = unwrapOuter(key);
  if (unwrapped !== trimmed && exactLookup.has(unwrapped)) {
    const hit = exactLookup.get(unwrapped)!;
    record({ layer: hit.layer, userKey: unwrapped, english: key.replace(unwrapped, hit.english), sourceKey: key, via: "unwrapped", ...base });
    continue;
  }
  // Multi-line prose: the userscript keyed each <br>-separated line, so a
  // source string is rebuilt from whole-line hits only. The userscript also
  // rebalanced English line breaks by width, and a line shared between two
  // passages carries the chunk of whichever passage was built first, so a
  // join is only trusted when every chunk ends the way its Chinese line does.
  if (/<br\s*\/?>/i.test(unwrapped)) {
    const lines = unwrapped.split(/<br\s*\/?>/i);
    let aligned = true;
    const translated = lines.map(line => {
      const l = line.trim();
      if (!l || !han.test(l)) return line;
      const english = exactLookup.get(l)?.english;
      if (english === undefined) return null;
      if (!endingsAlign(l, english)) aligned = false;
      return english;
    });
    if (translated.every(l => l !== null) && lines.some(l => han.test(l))) {
      if (aligned) {
        record({ layer: "proseExact", userKey: unwrapped, english: key.replace(unwrapped, translated.join("<br>")), sourceKey: key, via: "br-join", ...base });
      } else {
        brJoinMisaligned.push(key);
      }
      continue;
    }
  }
  if (key.includes("${")) {
    const s = skeleton(trimmed);
    const hit = templateLookup(s);
    if (!hit) continue;
    // Written as a {{}} skeleton so a variable rename keeps the entry. Any
    // glossary file may already own the skeleton (activities.json does).
    const owner = glossary.get(s);
    record({ layer: hit.layer, userKey: hit.userKey, english: hit.english, sourceKey: s, via: "template",
      state: owner ? stateOf(s) : state,
      ours: owner ? owner.english : ours && skeleton(ours.english.trim()),
      oursFrom: owner ? owner.file : ours?.from });
  }
}
// Glossary skeletons whose source is a .vue island or has no `${}` twin.
for (const [s, { english, file }] of glossary) {
  if (!s.includes(PLACEHOLDER) || claimed.has(s)) continue;
  const hit = templateLookup(s);
  if (!hit) continue;
  record({ layer: hit.layer, userKey: hit.userKey, english: hit.english, sourceKey: s, via: "template", state: stateOf(s), ours: english, oursFrom: file });
}

// ---------------------------------------------------------------- acceptance

// Userscript English -> our English, applied whole-word to imported prose so
// the fills use the glossary's vocabulary. Written by the term review.
const substitutionsPath = resolve(dumpDir, "substitutions.json");
const substitutions: { from: string; to: string }[] = existsSync(substitutionsPath)
  ? (await Bun.file(substitutionsPath).json()).sort((a: any, b: any) => b.from.length - a.from.length)
  : [];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const substitutionRules = substitutions.map(s => ({ ...s, re: new RegExp(`(?<![\\w-])${escapeRe(s.from)}(?![\\w-])`, "g") }));
let substituted = 0;
const substitutionUse = new Map<string, number>();
function normalizeVocabulary(english: string) {
  let out = english;
  for (const rule of substitutionRules) {
    const next = out.replace(rule.re, rule.to);
    if (next !== out) { substitutionUse.set(rule.from, (substitutionUse.get(rule.from) ?? 0) + 1); out = next; }
  }
  if (out !== english) substituted++;
  return out;
}

// Overwrites of existing English are opt-in, listed by key in this file after
// the review, and reported in the doc.
const overwritesPath = resolve(dumpDir, "overwrites.json");
const overwrites = new Set<string>(existsSync(overwritesPath) ? await Bun.file(overwritesPath).json() : []);

type Decision = { m: Match; action: "add" | "fill" | "overwrite" | "keep" | "skip"; reason?: string; english?: string };
const decisions: Decision[] = matches.map(m => {
  const english = m.via === "template" ? m.english.trim() : m.english;
  if (!english) return { m, action: "skip", reason: "empty English" };
  if (han.test(english.replace(/\{\{[^}]*\}\}/g, ""))) return { m, action: "skip", reason: "userscript English still has Chinese" };
  if (english !== english.trim() && m.via !== "template") return { m, action: "skip", reason: "glue fragment with edge whitespace" };
  if ([...m.sourceKey.replace(/<[^>]+>/g, "")].length === 1) return { m, action: "skip", reason: "single character key" };
  // A compiled value that is neither glossary nor catalog.raw is the generator
  // splicing known sub-terms into the Chinese ("Red TungstenHelmet"). That is
  // a placeholder in effect, so the userscript's whole-string English replaces it.
  const spliced = m.state === "translated" && m.oursFrom === "compiled";
  if ((m.state === "glossary" || m.state === "translated") && !spliced) {
    if (overwrites.has(m.sourceKey)) return { m, action: "overwrite", english: normalizeVocabulary(english) };
    return { m, action: "keep", reason: normalizeEnglish(m.ours!) === normalizeEnglish(english) ? "same" : "different" };
  }
  const isFill = glossary.has(m.sourceKey);
  return { m, action: isFill ? "fill" : "add", reason: spliced ? "replaces spliced composition" : undefined, english: normalizeVocabulary(english) };
});

// Route a new key to a glossary file by where its source string lives.
const routes: [string, string][] = [
  ["dialogues", "dialogues.json"], ["enemies", "enemies.json"], ["items", "items.json"], ["crafting_recipes", "items.json"],
  ["traders", "items.json"], ["trade", "items.json"], ["locations", "locations.json"], ["skills", "skills.json"],
  ["combat_stances", "skills.json"], ["activities", "activities.json"], ["html", "ui.json"],
];
function targetFile(m: Match) {
  if (glossary.has(m.sourceKey)) return glossary.get(m.sourceKey)!.file;
  if (m.sourceKey.includes(PLACEHOLDER)) return "templates.json";
  if (/^【[^】]+】$/.test(m.sourceKey)) return "brackets.json";
  const files = sourceKeys.get(m.sourceKey) ?? new Set();
  for (const [sourceFile, target] of routes) if (files.has(sourceFile)) return target;
  return "ui.json";
}

// ---------------------------------------------------------------- report

const width = (s: string | number, n: number) => String(s).padStart(n);
console.log("layer            total  in-src   same   diff  fills  unmatched");
for (const [name, c] of coverage) {
  console.log(`${name.padEnd(15)} ${width(c.total, 6)} ${width(c.inSource, 7)} ${width(c.same, 6)} ${width(c.different, 6)} ${width(c.fills, 6)} ${width(c.unmatched, 10)}`);
}
console.log(`proseRegex: ${(tables.proseRegex as any[]).length} patterns, ${regexSkeletons.size} converted, ${regexSkipped.length} skipped`);
console.log(`proseFrag \${} templates: ${fragTemplates.size} converted, ${fragTemplateSkipped.length} skipped`);
console.log(`buttons: ${Object.keys(tables.buttons).length} selectors; partTiers ${Object.keys(tables.partTiers).length}; REST_LOCATIONS ${tables.REST_LOCATIONS.length}; BACKWARD_LABELS ${tables.BACKWARD_LABELS.length}; REALM_TIERS ${tables.REALM_TIERS.length}`);

const count = (items: Decision[], by: (d: Decision) => string) => {
  const out: Record<string, number> = {};
  for (const d of items) out[by(d)] = (out[by(d)] ?? 0) + 1;
  return out;
};
console.log("matches by route:", count(decisions, d => d.m.via), `br-joins rejected as misaligned: ${brJoinMisaligned.length}`);
await Bun.write(resolve(dumpDir, "br-join-misaligned.json"), JSON.stringify(brJoinMisaligned, null, 2));
console.log("decisions:", count(decisions, d => d.action + (d.reason ? `:${d.reason}` : "")));
const accepted = decisions.filter(d => d.action !== "keep" && d.action !== "skip");
console.log("accepted by target file:", count(accepted, d => targetFile(d.m)));
console.log("accepted by layer:", count(accepted, d => d.m.layer));
console.log(`vocabulary substitutions changed ${substituted} entries`, Object.fromEntries([...substitutionUse].sort((a, b) => b[1] - a[1]).slice(0, 15)));

const stateBefore = count([...sourceKeys.keys()].map(k => ({ m: { sourceKey: k } as Match, action: "keep" as const, reason: stateOf(k) })), d => d.reason!);
console.log("source strings by state before merge:", stateBefore);
const stillMissing = [...sourceKeys.keys()].filter(k => !accepted.some(d => d.m.sourceKey === k) && (stateOf(k) === "untranslated" || stateOf(k) === "partial"));
console.log(`source strings still untranslated or partial after merge: ${stillMissing.length}`);

await Bun.write(resolve(dumpDir, "coverage.json"), JSON.stringify(Object.fromEntries(coverage), null, 2));
await Bun.write(resolve(dumpDir, "decisions.json"), JSON.stringify(decisions.map(d => ({ action: d.action, reason: d.reason, file: d.action === "keep" || d.action === "skip" ? undefined : targetFile(d.m), key: d.m.sourceKey, english: d.english ?? d.m.english, ours: d.m.ours, oursFrom: d.m.oursFrom, layer: d.m.layer, via: d.m.via, state: d.m.state })), null, 2));
await Bun.write(resolve(dumpDir, "regex-skipped.json"), JSON.stringify(regexSkipped, null, 2));
await Bun.write(resolve(dumpDir, "frag-template-skipped.json"), JSON.stringify(fragTemplateSkipped, null, 2));
await Bun.write(resolve(dumpDir, "still-missing.json"), JSON.stringify(stillMissing, null, 2));
const unmatched: Record<string, string[]> = {};
for (const layer of layers) unmatched[layer.name] = [...layer.entries.keys()].filter(k => layer.name === "proseRegex" ? !templateKeys.has(k) && !sourceSkeletons.has(k) : !resolveUserKey(k));
await Bun.write(resolve(dumpDir, "unmatched.json"), JSON.stringify(unmatched, null, 2));

if (!apply) process.exit(0);

// ---------------------------------------------------------------- apply

const written: Record<string, number> = {};
const byFile = new Map<string, Decision[]>();
for (const d of accepted) {
  const file = targetFile(d.m);
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file)!.push(d);
}
for (const [file, items] of byFile) {
  const values = glossaryData[file] ?? {};
  for (const d of items) {
    // Never a second definition: extract-glossary rejects duplicate keys.
    if (d.action === "add" && glossary.has(d.m.sourceKey)) continue;
    values[d.m.sourceKey] = d.english!;
    written[file] = (written[file] ?? 0) + 1;
  }
  // Keep the file's own line endings (core.autocrlf leaves most of them CRLF).
  const path = resolve(glossaryDir, file);
  const crlf = existsSync(path) && (await Bun.file(path).text()).includes("\r\n");
  const text = JSON.stringify(values, null, 2) + "\n";
  await Bun.write(path, crlf ? text.replace(/\n/g, "\r\n") : text);
}
console.log("written:", written);
