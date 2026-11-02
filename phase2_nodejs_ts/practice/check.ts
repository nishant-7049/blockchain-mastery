// Usage:
//   npm run check 03        → run tests for problem 03 of the current set
//   npm run check PS0 03    → be explicit about the set
//   npm test                → run everything
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const sets = readdirSync(import.meta.dirname).filter((d) => /^PS\d+_/.test(d)).sort();

let files: string[] = [];
if (args[0] === "all" || args.length === 0) {
  for (const set of sets) files.push(...testsIn(set));
} else {
  const setArg = args.length > 1 ? args[0] : sets[sets.length - 1].split("_")[0];
  const probArg = args.length > 1 ? args[1] : args[0];
  const set = sets.find((s) => s.startsWith(setArg + "_"));
  if (!set) exit(`No practice set matching "${setArg}". Available: ${sets.join(", ")}`);
  const prob = readdirSync(join(import.meta.dirname, set)).find((p) => p.startsWith(probArg.padStart(2, "0") + "_"));
  if (!prob) exit(`No problem "${probArg}" in ${set}`);
  files = testsIn(join(set, prob));
}

// --test-force-exit: a half-finished solution can leave a timer/handle running (problem 05!),
// which would otherwise keep the runner alive forever and swallow its output.
const r = spawnSync(process.execPath, ["--test", "--test-force-exit", "--test-concurrency=1", ...files], {
  stdio: "inherit",
  cwd: import.meta.dirname,
});
process.exit(r.status ?? 1);

function testsIn(dir: string): string[] {
  return readdirSync(join(import.meta.dirname, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".test.ts") && !f.includes("node_modules"))
    .map((f) => join(dir, f));
}

function exit(msg: string): never {
  console.error(msg);
  process.exit(1);
}
