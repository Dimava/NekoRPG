const catalog = await Bun.file("translations/en.full.json").json();
const han = /[\u4e00-\u9fff]/;
const src = (await Bun.file("src/display.js").text()).split("\n").slice(3749, 3862).join("\n");

const strings = new Set();
for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (han.test(m[1])) strings.add(m[1]);
for (const m of src.matchAll(/'((?:[^'\\]|\\.)*)'/g)) if (han.test(m[1])) strings.add(m[1]);

const buckets = { clean: [], partial: [], missing: [] };
for (const s of strings) {
  const v = catalog[s];
  if (v === undefined || v === s) buckets.missing.push(s);
  else if (han.test(v)) buckets.partial.push(s);
  else buckets.clean.push(s);
}
console.log(`clean ${buckets.clean.length}, partial ${buckets.partial.length}, missing ${buckets.missing.length}`);
for (const kind of ["partial", "missing"]) {
  console.log(`\n=== ${kind} ===`);
  for (const s of buckets[kind]) console.log(JSON.stringify(s));
}
