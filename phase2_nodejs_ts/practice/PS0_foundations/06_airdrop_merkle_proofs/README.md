# 06 — Airdrop Merkle Proofs

**Difficulty:** ★★★ · **Concept:** `Buffer` / bytes vs hex strings, `node:crypto`, Merkle trees (Phase 1.1 applied)

---

## 🚨 The Situation

You're launching a token airdrop for 40,000 addresses. Storing every allocation on chain would cost a fortune in gas, so
the contract stores only a **Merkle root**. Each user's claim request includes a **proof**.

Your backend builds the tree and serves proofs. A teammate prototyped it, and the Solidity contract rejects **every**
proof. The teammate's `hashPair` helper in `merkle.ts` "looks fine."

## 🎯 Your Task

Implement the four functions in `merkle.ts` to match this spec **exactly**. The contract uses the same rules, so the bytes must match.

```
leafHash(data)     = sha256( 0x00 ‖ data )
nodeHash(l, r)     = sha256( 0x01 ‖ l ‖ r )          ‖ = byte concatenation
```

- **Build levels bottom-up.** Pair nodes left to right. If a level has an **odd** count, the last node is **promoted**
  unchanged to the next level. It is *not* duplicated.
- `merkleRoot(leaves)`: throw on an empty list. A single leaf's root is its `leafHash`.
- `getProof(leaves, index)`: returns the sibling hashes from the bottom up, each tagged with whether the sibling sits on the
  `"left"` or `"right"`. A promoted node has no sibling at that level, so it adds no step. Throw on an out-of-range index.
- `verifyProof(data, proof, root)` → `boolean`.
- `fromHex(s)`: parse `"0x…"` or bare hex into a `Buffer`. **Throw** on odd length or any non-hex character.

```bash
npm run check 06
```

## 🧠 Concept Briefing

- A hash is 32 **bytes**. Its hex string is 64 **characters**. `sha256("ab")` hashes 2 bytes (the characters `a` and `b`),
  **not** the single byte `0xab`.
- `Buffer` is Node's byte array (a subclass of `Uint8Array`). Look up `Buffer.concat`, `Buffer.from(x, "hex")` and `buf.equals`.
- ⚠️ `Buffer.from("zz", "hex")` does **not** throw. Try it in the REPL, and try `Buffer.from("abc", "hex")` too.
- Why the `0x00`/`0x01` prefixes? Without them, an attacker can present an *internal node* as if it were a leaf
  (a second-preimage attack). One test checks for exactly this.

<details><summary>Hint 1</summary>

The teammate's bug: `left.toString("hex") + right.toString("hex")` is a 128-character **string**, and hashing it hashes 128 bytes of ASCII.
</details>

<details><summary>Hint 2</summary>

For `getProof`, walk up the levels while tracking the target's index. At each level the sibling is at `index ^ 1`, if it exists.
The next level's index is `index >> 1`.
</details>

<details><summary>Hint 3</summary>

`fromHex`: check the string with a regex *before* handing it to `Buffer.from`.
</details>

## 🔍 Debrief

1. Bitcoin's original Merkle tree **duplicates** the last node on odd levels. Look up CVE-2012-2459. What went wrong?
2. Why does `Buffer.from(hex, "hex")` fail silently? Where else in a backend could silent truncation hurt you?
3. OpenZeppelin's `MerkleProof.sol` sorts each pair instead of tracking left/right. What does that trade away?
4. For 40k leaves, how many hashes are in a proof? How many would there be for 1 billion?
