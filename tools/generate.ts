const steps = [
  "extract-translations.ts",
  // Reuses the previous run's compiled catalog to write a glossary input, so
  // extract-glossary has to see it before it compiles the next one.
  "extract-template-keys.ts",
  "extract-glossary.ts",
  "extract-common-sequences.ts",
  "extract-bracket-glossary.ts",
  "generate-en-html.ts",
];

for (const step of steps) {
  const result = Bun.spawnSync(["bun", "run", step], {
    cwd: import.meta.dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

console.log("Generation complete: en.html is ready.");
