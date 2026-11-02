import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { indexTransactions, hashTx, type Tx } from "./indexer.ts";

function makeTxs(n: number): Tx[] {
  const txs: Tx[] = new Array(n);
  for (let i = 0; i < n; i++) {
    txs[i] = { from: `0xfrom${i % 97}`, to: `0xto${i % 89}`, value: BigInt(i) * 10n ** 15n, nonce: i };
  }
  return txs;
}

const txs = makeTxs(200_000);

// Baseline: how long does the plain synchronous work take on THIS machine?
function blockingBaseline(): number {
  const t0 = performance.now();
  const m = new Map<string, Tx>();
  for (const tx of txs) m.set(hashTx(tx), tx);
  return performance.now() - t0;
}

test("index is correct", async () => {
  const small = makeTxs(5_000);
  const index = await indexTransactions(small);
  assert.equal(index.size, small.length);
  for (const tx of small) assert.equal(index.get(hashTx(tx)), tx);
});

test("event loop stays responsive while indexing", async () => {
  const baseline = blockingBaseline();

  const beats: number[] = [];
  const heartbeat = setInterval(() => beats.push(performance.now()), 5);

  // let the heartbeat start ticking
  await new Promise((r) => setTimeout(r, 20));

  const start = performance.now();
  const index = await indexTransactions(txs);
  const end = performance.now();
  clearInterval(heartbeat);

  assert.equal(index.size, txs.length);

  const points = [start, ...beats.filter((t) => t > start && t < end), end];
  let maxGap = 0;
  for (let i = 1; i < points.length; i++) maxGap = Math.max(maxGap, points[i] - points[i - 1]);

  const took = end - start;
  console.log(`  blocking baseline: ${baseline.toFixed(0)}ms | yours: ${took.toFixed(0)}ms | max heartbeat gap: ${maxGap.toFixed(1)}ms`);

  assert.ok(
    maxGap < 100,
    `Event loop was blocked for ${maxGap.toFixed(0)}ms. Timers could not run. (limit: 100ms)`,
  );
  assert.ok(
    took < baseline * 4 + 500,
    `Too slow: ${took.toFixed(0)}ms vs ${baseline.toFixed(0)}ms baseline. Are you yielding too often?`,
  );
});
