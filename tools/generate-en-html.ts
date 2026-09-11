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

let output = source.replace(/<html(?=\s|>)/i, '$& lang="en"');

const gameModule = /(<script\s+type\s*=\s*["']module["']\s+src\s*=\s*["']src\/main\.js["'][^>]*>\s*<\/script>)/i;
if (!gameModule.test(output)) throw new Error("Could not find the src/main.js module script in index.html");
output = output.replace(gameModule, '<script src="translations/en.full.js"></script>\n        $1');

await Bun.write(
  browserCatalogPath,
  `globalThis.NekoRPGTranslations = ${JSON.stringify(catalog)};\n`,
);
await Bun.write(outputPath, output);

const relativeCatalog = catalogPath.slice(root.length + 1).replaceAll("\\", "/");
console.log(`Wrote en.html as index.html + lang=en + catalog (${relativeCatalog}).`);
console.log("Generated translations/en.full.js for browser use.");
