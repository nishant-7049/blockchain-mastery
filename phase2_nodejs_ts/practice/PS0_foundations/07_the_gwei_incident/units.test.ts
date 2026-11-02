import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wei, gwei, gweiToWei, addWei, toAddress, sendTransaction } from "./units.ts";

const here = fileURLToPath(new URL(".", import.meta.url));

test("usage.ts is untouched", () => {
  const hash = createHash("sha256").update(readFileSync(new URL("./usage.ts", import.meta.url))).digest("hex");
  assert.equal(hash, "604c50aa6249943d846d2653c6a6ca90e876278f087fa1c2f515194a7fc9106a", "usage.ts was modified. Put your changes in units.ts only.");
});

test("compiler rejects every unit mix-up and accepts correct code", () => {
  const tsc = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));
  const r = spawnSync(process.execPath, [tsc, "--noEmit", "-p", here], { encoding: "utf8" });
  const out = (r.stdout + r.stderr)
    .replaceAll("error TS2578: Unused '@ts-expect-error' directive.", "error: this line compiled, but it should be a type error")
    .trim();
  assert.equal(r.status, 0, "\n" + out);
});

test("runtime: zero-cost brands", () => {
  const w = wei(5n);
  assert.equal(typeof w, "bigint");
  assert.equal(w, 5n);
  assert.equal(typeof gwei(1n), "bigint");
  assert.equal(gweiToWei(gwei(30n)), 30_000_000_000n);
  assert.equal(addWei(wei(1n), wei(2n)), 3n);
});

test("runtime: toAddress validates and normalizes", () => {
  const a = toAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  assert.equal(typeof a, "string");
  assert.equal(a, "0x742d35cc6634c0532925a3b844bc454e4438f44e");
  for (const bad of ["0xabc", "742d35Cc6634C0532925a3b844Bc454e4438f44e", "0x742d35Cc6634C0532925a3b844Bc454e4438f44Z", "0x742d35Cc6634C0532925a3b844Bc454e4438f44e00", ""]) {
    assert.throws(() => toAddress(bad), `should reject ${JSON.stringify(bad)}`);
  }
  assert.equal(sendTransaction(a, wei(7n)), "send 7 wei to 0x742d35cc6634c0532925a3b844bc454e4438f44e");
});
