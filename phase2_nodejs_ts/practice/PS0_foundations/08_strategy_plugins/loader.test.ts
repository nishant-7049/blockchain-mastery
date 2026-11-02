import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStrategies, reloadStrategies } from "./loader.ts";

let root: string;
let dir: string;

const plugins: Record<string, string> = {
  "a-uniswap.mjs": `export default { name: "uniswap", quote: (x) => (x * 997n) / 1000n };`,
  "b-curve.cjs": `module.exports = { name: "curve", quote: (x) => (x * 9996n) / 10000n };`,
  "c-balancer.mjs": `const fee = await Promise.resolve(30n);\nexport const strategy = { name: "balancer", quote: (x) => (x * (10000n - fee)) / 10000n };`,
  "d-legacy.cjs": `exports.strategy = { name: "legacy", quote: (x) => x };`,
  "NOTES.md": `# do not load me\nthis is not javascript`,
  "types.d.ts": `export declare const nope: number;`,
};

before(() => {
  root = mkdtempSync(join(tmpdir(), "plugins-"));
  dir = join(root, "strategies #1");
  mkdirSync(dir);
  for (const [f, src] of Object.entries(plugins)) writeFileSync(join(dir, f), src);
});

after(() => rmSync(root, { recursive: true, force: true }));

test("loads all four export styles, in filename order, ignoring other files", async () => {
  const s = await loadStrategies(dir);
  assert.deepEqual(s.map((x) => x.name), ["uniswap", "curve", "balancer", "legacy"]);
  assert.deepEqual(s.map((x) => x.quote(10_000n)), [9970n, 9996n, 9970n, 10_000n]);
});

test("broken plugin → error names the file", async () => {
  const bad = join(root, "bad dir");
  mkdirSync(bad);
  writeFileSync(join(bad, "ok.mjs"), plugins["a-uniswap.mjs"]);
  writeFileSync(join(bad, "zz-broken.mjs"), `export default { name: 42, quote: "nope" };`);
  await assert.rejects(loadStrategies(bad), (e: Error) => e.message.includes("zz-broken.mjs"));

  const bad2 = join(root, "bad dir 2");
  mkdirSync(bad2);
  writeFileSync(join(bad2, "empty.cjs"), `module.exports = {};`);
  await assert.rejects(loadStrategies(bad2), (e: Error) => e.message.includes("empty.cjs"));
});

test("hot reload picks up edits to both ESM and CJS plugins", async () => {
  const hot = join(root, "hot #reload");
  mkdirSync(hot);
  writeFileSync(join(hot, "a.mjs"), `export default { name: "esm", quote: () => 1n };`);
  writeFileSync(join(hot, "b.cjs"), `module.exports = { name: "cjs", quote: () => 1n };`);

  const v1 = await loadStrategies(hot);
  assert.deepEqual(v1.map((s) => s.quote(0n)), [1n, 1n]);

  writeFileSync(join(hot, "a.mjs"), `export default { name: "esm", quote: () => 2n };`);
  writeFileSync(join(hot, "b.cjs"), `module.exports = { name: "cjs", quote: () => 2n };`);
  const v2 = await reloadStrategies(hot);
  assert.deepEqual(v2.map((s) => s.quote(0n)), [2n, 2n], "reload returned stale code");

  writeFileSync(join(hot, "a.mjs"), `export default { name: "esm", quote: () => 3n };`);
  writeFileSync(join(hot, "b.cjs"), `module.exports = { name: "cjs", quote: () => 3n };`);
  const v3 = await reloadStrategies(hot);
  assert.deepEqual(v3.map((s) => s.quote(0n)), [3n, 3n], "second reload returned stale code");
});
