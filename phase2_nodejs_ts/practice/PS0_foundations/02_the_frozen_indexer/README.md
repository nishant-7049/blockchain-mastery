# 02 — The Frozen Indexer

**Difficulty:** ★★☆ · **Concept:** blocking the event loop, microtasks vs macrotasks

---

## 🚨 The Incident

Your indexer service does two things:
1. It serves `GET /health`, which Kubernetes pings every few seconds.
2. When a new block batch arrives, it hashes every transaction and builds an in-memory index.

On quiet days everything works. On a busy day a batch of 200k transactions arrives. `/health`
stops answering, Kubernetes decides the pod is dead and **kills it in the middle of indexing**. The
pod restarts, receives the same batch, freezes again and gets killed again. You're stuck in a crash loop.

A teammate says: *"Easy, the function is already `async`, so it doesn't block."* They're wrong.

## 🎯 Your Task

Fix `indexTransactions` in `indexer.ts` so the event loop stays responsive while it works:

- While indexing runs, other callbacks (timers, I/O, health checks) must never wait more than **~100ms**.
- The result must stay the same: a `Map` from tx hash to tx.
- It must stay reasonably fast. Yielding after *every single* transaction is too slow (the test has a time budget).
- No worker threads. That's a valid real-world fix, but this problem is about the event loop itself.

```bash
npm run check 02
```

The test starts a `setInterval` heartbeat, runs your indexer, and measures the **largest gap between heartbeats**.

## 🧠 Concept Briefing

Re-read *"The Call Stack, Callback Queue, and Microtask Queue"* and *"One Loop Tick"* in
`docs/foundation/2_0b_nodejs_architecture.md`. Then think about these questions:

- Does marking a function `async` move its work to a different thread?
- A timer callback is a **macrotask**. When does the loop get a chance to run one?
- If you `await` something inside your loop, which queue does the continuation go into? Does that give timers a turn?

<details><summary>Hint 1</summary>

Try this first: add `await Promise.resolve()` inside the loop and run the test. It still fails. Work out *why* before you continue.
That failure is the whole lesson of this problem.
</details>

<details><summary>Hint 2</summary>

You need to hand control back to the event loop so it can run a **macrotask** phase. Which API schedules
something for "after I/O and timers get their turn"? Wrap it in a Promise so you can `await` it.
</details>

<details><summary>Hint 3</summary>

Process in **chunks**. Do N transactions, yield, do the next N. Pick N by time, not by count: "work until ~10ms
has passed, then yield" adapts to any machine.
</details>

## 🔍 Debrief

1. Why did `await Promise.resolve()` not help, and what exactly did `setImmediate` change?
2. Chunking makes the total work take *longer*. Why is that still the right trade-off for a server?
3. At what point would you give up on chunking and move to `worker_threads`? What does that cost?
4. `crypto.createHash` is synchronous, but `crypto.pbkdf2` has an async version. Why the difference? (Think libuv thread pool.)
