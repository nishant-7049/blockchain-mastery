# 04 — Banned by the RPC Provider

**Difficulty:** ★★☆ · **Concept:** promises are eager, `Promise.all` does not limit anything, building a concurrency pool

---

## 🚨 The Incident

A backfill job has to download blocks `18_000_000 → 18_010_000`. Your RPC plan allows **5 concurrent
requests**. Anything above that gets `429 Too Many Requests`, and repeated abuse gets your API key banned.

Attempt 1 fetched all blocks at once with `Promise.all(blocks.map(fetch))`. Result: banned in 3 seconds.

Attempt 2 is the "chunked" version you'll find in `fetch-blocks.ts`. It looks like it sends 5 at a time.
It still got banned. The provider's dashboard shows **10,000 concurrent requests**.

## 🎯 Your Task

Implement `mapWithConcurrency(items, limit, fn)` in `fetch-blocks.ts`. `fetchBlocks` already uses it.

1. At most `limit` calls to `fn` are running at any moment. The pool must also **stay full**: when one call
   finishes, the next one starts right away. Don't wait for a whole batch of 5 to finish.
2. Results come back **in input order**, even though they finish in random order.
3. If any call rejects, the returned promise rejects with that error, and **no new calls are started** after that.
   Calls already in flight may finish; their results are ignored.
4. `limit` must be a positive integer (throw `RangeError` otherwise). An empty input resolves to `[]`.

No libraries (`p-limit` exists; you're writing it).

```bash
npm run check 04
```

## 🧠 Concept Briefing

- When does the network request actually **start**: when the promise is *created* or when it is *awaited*?
- Find the exact line in the buggy code where all 10,000 requests start.
- "Always keep 5 running" is different from "run 5, wait for all 5, run the next 5". Which one wastes time when one request is slow?

<details><summary>Hint 1</summary>

The bug is `items.map(fn)`. Calling `fn` *is* starting the request. `await` only waits for a result; it never starts or delays anything.
</details>

<details><summary>Hint 2</summary>

Start `limit` **workers**. Each worker runs a loop: grab the next unclaimed index, `await fn(item)`, store the result at
that index, repeat. Because JS is single-threaded, "grab the next index" (`i++`) can't race with another worker.
</details>

<details><summary>Hint 3</summary>

For requirement 3, the workers need a shared flag they check before claiming the next item.
</details>

## 🔍 Debrief

1. Why can't a Promise be "paused"? How does that compare to a **function that returns** a Promise?
2. Your workers share `nextIndex` with no lock. Why is that safe here when it wasn't in problem 03? (Hint: where are the `await`s?)
3. What would you add to handle `429` responses gracefully (retry with backoff)? Where does that logic belong: inside `fn` or inside the pool?
