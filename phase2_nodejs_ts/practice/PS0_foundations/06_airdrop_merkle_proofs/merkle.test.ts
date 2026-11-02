import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fromHex, merkleRoot, getProof, verifyProof } from "./merkle.ts";

const leaves = (n: number) => Array.from({ length: n }, (_, i) => Buffer.from(`0xaddr${i}:${(i + 1) * 100}`));
const sha = (...parts: Uint8Array[]) => createHash("sha256").update(Buffer.concat(parts)).digest();

test("fromHex parses strictly", () => {
  assert.deepEqual(fromHex("0xdeadBEEF"), Buffer.from([0xde, 0xad, 0xbe, 0xef]));
  assert.deepEqual(fromHex("00ff"), Buffer.from([0x00, 0xff]));
  assert.deepEqual(fromHex("0x"), Buffer.alloc(0));
  for (const bad of ["0xabc", "zz", "0xgg", "0x12 34", "abcx", "0X12"]) {
    assert.throws(() => fromHex(bad), `should throw for ${bad}`);
  }
});

test("single leaf root is the leaf hash (with 0x00 prefix)", () => {
  const [a] = leaves(1);
  assert.deepEqual(merkleRoot([a]), sha(Buffer.from([0]), a));
});

test("roots match the spec exactly", () => {
  const L = (d: Uint8Array) => sha(Buffer.from([0]), d);
  const N = (l: Uint8Array, r: Uint8Array) => sha(Buffer.from([1]), l, r);
  const [a, b, c, d, e] = leaves(5);

  assert.equal(merkleRoot([a, b]).toString("hex"), N(L(a), L(b)).toString("hex"));
  assert.equal(
    merkleRoot([a, b, c]).toString("hex"),
    N(N(L(a), L(b)), L(c)).toString("hex"),
    "odd level: last node must be promoted, not duplicated",
  );
  assert.equal(
    merkleRoot([a, b, c, d, e]).toString("hex"),
    N(N(N(L(a), L(b)), N(L(c), L(d))), L(e)).toString("hex"),
  );
  assert.equal(merkleRoot([a, b, c]).length, 32);
});

test("known root for the launch list (cross-checked with the contract)", () => {
  assert.equal(
    merkleRoot(leaves(7)).toString("hex"),
    "7ebaf19ea4ec99af27367721504967aafaeab993005e84688bb527996ea17208",
  );
});

test("every proof verifies, for many tree sizes", () => {
  for (let n = 1; n <= 33; n++) {
    const ls = leaves(n);
    const root = merkleRoot(ls);
    for (let i = 0; i < n; i++) {
      const proof = getProof(ls, i);
      assert.ok(verifyProof(ls[i], proof, root), `proof failed: n=${n} i=${i}`);
      assert.ok(proof.length <= Math.ceil(Math.log2(n)), `proof too long: n=${n} i=${i} len=${proof.length}`);
    }
  }
});

test("proof shape for a 3-leaf tree", () => {
  const ls = leaves(3);
  const L = (d: Uint8Array) => sha(Buffer.from([0]), d);
  const N = (l: Uint8Array, r: Uint8Array) => sha(Buffer.from([1]), l, r);
  assert.deepEqual(getProof(ls, 2), [{ sibling: N(L(ls[0]), L(ls[1])), position: "left" }]);
  assert.deepEqual(getProof(ls, 0), [
    { sibling: L(ls[1]), position: "right" },
    { sibling: L(ls[2]), position: "right" },
  ]);
});

test("tampering is rejected", () => {
  const ls = leaves(10);
  const root = merkleRoot(ls);
  const proof = getProof(ls, 3);
  assert.equal(verifyProof(Buffer.from("0xattacker:1000000"), proof, root), false, "wrong data verified");
  assert.equal(verifyProof(ls[4], proof, root), false, "proof for leaf 3 verified leaf 4");
  const flipped = proof.map((s, i) => (i === 0 ? { ...s, position: s.position === "left" ? "right" : "left" } as const : s));
  assert.equal(verifyProof(ls[3], flipped, root), false, "position is ignored");
});

test("second-preimage: an internal node cannot pose as a leaf", () => {
  const ls = leaves(2);
  const root = merkleRoot(ls);
  const L = (d: Uint8Array) => sha(Buffer.from([0]), d);
  const forged = Buffer.concat([L(ls[0]), L(ls[1])]);
  assert.equal(verifyProof(forged, [], root), false);
  assert.equal(verifyProof(Buffer.concat([Buffer.from([1]), forged]), [], root), false);
});

test("errors", () => {
  assert.throws(() => merkleRoot([]));
  assert.throws(() => getProof(leaves(4), 4));
  assert.throws(() => getProof(leaves(4), -1));
});
