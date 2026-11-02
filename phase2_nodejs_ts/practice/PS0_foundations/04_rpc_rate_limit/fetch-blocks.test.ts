import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency, fetchBlocks, type BlockRpc } from "./fetch-blocks.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tracker() {
  const t = { inFlight: 0, max: 0, started: 0 };
  return t;
}

test("fetchBlocks respects the provider limit and keeps order", { timeout: 3000 }, async () => {
  const t = tracker();
  const rpc: BlockRpc = {
    async getBlock(n) {
      t.inFlight++;
      t.started++;
      t.max = Math.max(t.max, t.inFlight);
      if (t.inFlight > 5) throw new Error("429 Too Many Requests");
      await sleep(Math.random() * 15);
      t.inFlight--;
      return { number: n, hash: `0x${n.toString(16)}` };
    },
  };
  const blocks = await fetchBlocks(rpc, 18_000_000, 18_000_199, 5);
  assert.equal(blocks.length, 200);
  blocks.forEach((b, i) => assert.equal(b.number, 18_000_000 + i, "results out of order"));
  assert.equal(t.max, 5, `max concurrent requests was ${t.max}`);
});

test("pool stays full: a slow item does not stall the others", { timeout: 3000 }, async () => {
  // item 0 takes 200ms, the other 20 take 10ms each. limit 2.
  // A batching implementation waits for item 0 before starting item 2 → ~300ms.
  // A real pool keeps one slot on item 0 and runs the other 20 through the second slot → ~200ms.
  const t0 = performance.now();
  await mapWithConcurrency(Array.from({ length: 21 }, (_, i) => i), 2, (i) => sleep(i === 0 ? 200 : 10));
  const took = performance.now() - t0;
  assert.ok(took < 280, `took ${took.toFixed(0)}ms, pool is not refilling slots immediately`);
});

test("rejects on first error and stops starting new work", { timeout: 3000 }, async () => {
  let started = 0;
  const err = new Error("boom");
  await assert.rejects(
    mapWithConcurrency(Array.from({ length: 100 }, (_, i) => i), 3, async (i) => {
      started++;
      await sleep(5);
      if (i === 4) throw err;
      return i;
    }),
    (e) => e === err,
  );
  await sleep(50); // give any runaway workers a chance to misbehave
  assert.ok(started <= 8, `${started} calls started, work kept going after the failure`);
});

test("edge cases", { timeout: 3000 }, async () => {
  assert.deepEqual(await mapWithConcurrency([], 5, async (x) => x), []);
  assert.deepEqual(await mapWithConcurrency([1, 2, 3], 10, async (x) => x * 2), [2, 4, 6]);
  assert.deepEqual(await mapWithConcurrency(["a", "b"], 1, async (x, i) => `${x}${i}`), ["a0", "b1"]);
  await assert.rejects(mapWithConcurrency([1], 0, async (x) => x), RangeError);
  await assert.rejects(mapWithConcurrency([1], 1.5, async (x) => x), RangeError);
});

test("nothing starts synchronously beyond the limit", { timeout: 3000 }, async () => {
  let started = 0;
  const p = mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 4, async (i) => {
    started++;
    await sleep(1);
    return i;
  });
  await Promise.resolve();
  assert.ok(started <= 4, `${started} calls started immediately`);
  await p;
});
