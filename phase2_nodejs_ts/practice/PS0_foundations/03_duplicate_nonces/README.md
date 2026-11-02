# 03 — Duplicate Nonces

**Difficulty:** ★★☆ · **Concept:** interleaving at `await`, race conditions on a single thread, caching promises instead of values

---

## 🚨 The Incident

Your airdrop bot sends 50 transactions from one hot wallet **concurrently**. Each one asks the
`NonceManager` for the next nonce.

Only **one** transaction lands on chain. The other 49 fail with `nonce too low` / `replacement transaction underpriced`.
The logs show all 50 transactions were signed with nonce `7`.

A teammate says: *"Impossible. Node is single-threaded, so there are no race conditions."*

## 🎯 Your Task

Fix `NonceManager` in `nonce-manager.ts`:

1. `next(address)` hands out **sequential, unique** nonces, even when called 50× at the same moment.
2. The RPC (`getTransactionCount`) is called **at most once per address** until `reset(address)`.
3. Different addresses **must not wait on each other**. Wallet B's RPC call must not queue behind wallet A's.
4. If the RPC call **fails**, every caller waiting on it gets the error, and the **next** call after that
   tries the RPC again. A single network blip must not break the wallet forever.
5. `reset(address)` forgets the address. The next `next()` goes back to the RPC.

No libraries and no mutex packages. The fix is small once you see the problem.

```bash
npm run check 03
```

## 🧠 Concept Briefing

Node runs your JS on one thread, so two lines of JS never execute *at the same time*. But an `async`
function **pauses at every `await`**, and other code runs before it resumes.

Take a piece of paper and trace 3 concurrent calls to the buggy `next()` step by step. At each `await`, write down what
is in `this.nonces` and which call runs next.

<details><summary>Hint 1</summary>

The race window is between *"I checked the map and it was empty"* and *"I wrote to the map"*. There's an `await` in between.
</details>

<details><summary>Hint 2</summary>

What if the map stored something you can put there **immediately**, before any `await`, so later callers can see
that a fetch is already in progress?
</details>

<details><summary>Hint 3</summary>

A `Promise` is a value you can store and share. Many callers can `await` the *same* promise. After that,
incrementing the counter is synchronous, so no other code can run in between.
</details>

## 🔍 Debrief

1. Write out the exact interleaving that gave all 50 calls the same nonce in the original code.
2. Why does caching a *promise* fix the RPC-once requirement **and** the uniqueness requirement at the same time?
3. How does requirement 4 relate to a real bug: caching a rejected promise forever?
4. This fixes concurrency *inside one process*. What breaks if you run **two** bot instances with the same wallet? How would you fix that? (Redis, coming in 2.10.)
