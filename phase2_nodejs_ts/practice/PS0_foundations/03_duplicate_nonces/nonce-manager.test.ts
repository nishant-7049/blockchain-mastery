import { test } from "node:test";
import assert from "node:assert/strict";
import { NonceManager, type NonceRpc } from "./nonce-manager.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class MockRpc implements NonceRpc {
  calls: string[] = [];
  inFlight = 0;
  maxInFlight = 0;
  failNext = 0;
  chain: Record<string, number>;
  constructor(chain: Record<string, number>) {
    this.chain = chain;
  }
  async getTransactionCount(address: string): Promise<number> {
    this.calls.push(address);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await sleep(20);
    this.inFlight--;
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("ECONNRESET");
    }
    return this.chain[address] ?? 0;
  }
}

test("sequential calls still work", async () => {
  const nm = new NonceManager(new MockRpc({ "0xA": 7 }));
  assert.equal(await nm.next("0xA"), 7);
  assert.equal(await nm.next("0xA"), 8);
  assert.equal(await nm.next("0xA"), 9);
});

test("50 concurrent calls get 50 unique sequential nonces", async () => {
  const rpc = new MockRpc({ "0xA": 7 });
  const nm = new NonceManager(rpc);
  const nonces = await Promise.all(Array.from({ length: 50 }, () => nm.next("0xA")));
  assert.deepEqual([...nonces].sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => 7 + i));
  assert.equal(new Set(nonces).size, 50, "duplicate nonces handed out");
});

test("RPC is called once per address, even under concurrency", async () => {
  const rpc = new MockRpc({ "0xA": 1, "0xB": 100 });
  const nm = new NonceManager(rpc);
  await Promise.all([
    ...Array.from({ length: 10 }, () => nm.next("0xA")),
    ...Array.from({ length: 10 }, () => nm.next("0xB")),
  ]);
  await nm.next("0xA");
  assert.equal(rpc.calls.filter((a) => a === "0xA").length, 1);
  assert.equal(rpc.calls.filter((a) => a === "0xB").length, 1);
});

test("different addresses do not block each other", async () => {
  const rpc = new MockRpc({ "0xA": 0, "0xB": 0, "0xC": 0 });
  const nm = new NonceManager(rpc);
  await Promise.all([nm.next("0xA"), nm.next("0xB"), nm.next("0xC")]);
  assert.equal(rpc.maxInFlight, 3, "RPC calls for different addresses were serialized");
});

test("RPC failure rejects all waiters, and the next call retries", async () => {
  const rpc = new MockRpc({ "0xA": 5 });
  const nm = new NonceManager(rpc);
  rpc.failNext = 1;
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => nm.next("0xA")));
  assert.ok(results.every((r) => r.status === "rejected"), "every waiter should see the RPC error");
  assert.equal(rpc.calls.length, 1);

  assert.equal(await nm.next("0xA"), 5, "after a failure, the next call must retry the RPC");
  assert.equal(await nm.next("0xA"), 6);
  assert.equal(rpc.calls.length, 2);
});

test("reset forces a fresh RPC read", async () => {
  const rpc = new MockRpc({ "0xA": 3 });
  const nm = new NonceManager(rpc);
  await nm.next("0xA");
  await nm.next("0xA");
  rpc.chain["0xA"] = 42; // e.g. a tx was sent from another tool
  nm.reset("0xA");
  assert.equal(await nm.next("0xA"), 42);
  assert.equal(rpc.calls.length, 2);
});
