import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startLagMonitor } from "./lag-monitor.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function block(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {}
}

const timeoutCount = () => process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

test("idle loop has low lag", async () => {
  const m = startLagMonitor(10);
  await sleep(300);
  const r = m.stop();
  assert.ok(r.samples >= 15, `only ${r.samples} samples in 300ms at 10ms interval`);
  assert.ok(r.maxLagMs >= 0 && r.maxLagMs < 40, `idle maxLag was ${r.maxLagMs}ms`);
});

test("detects a 200ms block", async () => {
  const m = startLagMonitor(10);
  await sleep(50);
  block(200);
  await sleep(50);
  const r = m.stop();
  assert.ok(r.maxLagMs >= 170 && r.maxLagMs <= 300, `expected ~200ms lag, got ${r.maxLagMs}ms`);
});

test("stop() leaves nothing scheduled and freezes the report", async () => {
  const before = timeoutCount();
  const m = startLagMonitor(5);
  await sleep(30);
  const r1 = m.stop();
  assert.equal(timeoutCount(), before, "monitor left a timer behind after stop()");
  await sleep(30);
  const r2 = m.stop();
  assert.equal(r2.samples, r1.samples, "samples kept increasing after stop()");
});

test("a forgotten monitor does not keep the process alive", () => {
  const modUrl = new URL("./lag-monitor.ts", import.meta.url).href;
  const script = `import { startLagMonitor } from ${JSON.stringify(modUrl)}; startLagMonitor(10); console.log("started");`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    timeout: 3000,
    encoding: "utf8",
  });
  assert.ok(r.stdout.includes("started"), `child failed: ${r.stderr}`);
  assert.notEqual(r.signal, "SIGTERM", "process did not exit on its own, the monitor is holding it open");
  assert.equal(r.status, 0, r.stderr);
});
