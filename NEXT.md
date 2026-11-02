# NEXT

> The only file that matters when you sit down. Update it in the **last 2 minutes** of every session.
> Coming back after a break? Follow the Re-entry Protocol in `STUDY_PLAN.md`, not your memory.

## 🎯 Right now

**Rebuild pass.** Decided 2026-11-02: re-solve PS0 **01 → 05 from blank**, in order, by myself.
Not because the concepts are gone — the debriefs prove they aren't — but because for 03 and 04 the
diagnosis was mine and the *implementation* was Claude's, and explaining a fix is not the same as
producing it. Job situation makes depth non-negotiable: no more hanging threads.

The starters are restored and all five are ⬜ again. My old solutions, my scratch tests and every
`NOTES.md` are in **`phase2_nodejs_ts/practice/.solutions/`** (gitignored — on disk, out of the repo).

**The rule for this pass: do not open `.solutions/` until my own version passes, or until I have been
genuinely stuck for 30+ minutes.** Reading my own old answer is not solving it.

Start with **01 — The Missing Wei** (★☆☆). It should be quick; that's the point, it rebuilds the habit.

```bash
cd phase2_nodejs_ts/practice
nvm use            # .nvmrc → Node 24. Check: node --version
npm run check 01
```

Order: 01 → 02 → 03 → 04 → 05, then on to **2.0d + 08** where I left off.
Docs already read and not to be re-read: 2.0a, 2.0b, 2.0c (notes for 2.0c are beside the doc).

## 📅 This Saturday

**Sat 2026-11-07** — derive it on the day (STUDY_PLAN rule). If the rebuild pass is still running,
Saturday takes whichever of 03/04 is next: those are the two that actually need an unbroken block.
Once the rebuild is done, Saturday goes back to **08 (Strategy Plugins)**, ★★★, with 2.0d read first.
**06 (Merkle)** wants 2.0f (TypeScript's Type System), which **does not exist yet** — flag it then.

## 🧠 Where my head was

> ⚠️ Everything below is from the **first pass**. It is a record of what I worked out, not a
> shortcut — the point of the rebuild is to produce the code without it.


Solved 04, 5/5, and debriefed it. Diagnosed it right first try: `items.map(fn)` fires all 200 RPC
calls synchronously, so `slice` + `Promise.all` only limited *when I read results*, never when work
started. **Promises are eager — creating one starts the work.** A promise is a receipt for an order
already placed; `() => fn(x)` is the menu item. Exact mirror of 03: there I wanted *hot* work (one
in-flight call, 50 sharers), here I needed *cold* work.

Second half of the problem was structural, not conceptual: batching stalls. A batch is only as fast as
its slowest member and every other slot idles waiting (309ms → 208ms once it became a real pool of
`limit` persistent workers pulling from one shared cursor — libuv's 4 threads, rebuilt by hand).

Got Q2 wrong at first — said sharing `next` was safe because "the limit is limited". **Worker count is
irrelevant.** `next++` is safe because read-add-store is ONE synchronous step; 03 was unsafe because an
`await` sat *between* its read and its write. The rule: a shared variable needs no lock iff every
read-modify-write on it finishes in one synchronous run. (In Go/Java `next++` across threads *is* a
data race — I get it free only because Node never preempts mid-statement.)
⚠️ Recurring bug, **fifth** appearance: `fn(item, i)` passed the chunk's start index instead of the
item's index, and the tests passed anyway because the only test that checks the index uses `limit = 1`.
Green tests, wrong code. See 04/NOTES.md for the full tally.

Re-entry after a 5-day break, done by the protocol: re-ran 03 (6/6, 247ms), then one unit.
Answered 03's Q2 — one shared promise, everyone attaches, each resumption reads-and-bumps. Three
corrections worth keeping: (1) the promise is published by `fetchOnce` **synchronously, before the
first await** — that's what closes the window, not the `await` itself; (2) uniqueness is **atomicity**:
`get` then `set(+1)` with no await between them is a critical section, and resumptions drain FIFO so
caller *n* deterministically gets `7 + n − 1`; (3) a promise is a **value, not an action** — awaiting
one 50× gives 50 callers one result, which is why it shares the failure too. Pattern names:
promise memoization / request coalescing / single-flight.

Solved 03. The teammate's sentence has two halves and only one is true: Node **is** single-threaded,
but "therefore no race conditions" is false. Races need **interleaving**, not parallelism. What's
atomic is a *synchronous run*, not a *function* — every `await` chops the function into separate
critical sections.

My attempt worked by guessing: a `fetchingAddress` boolean plus `await delay(200)`. It passed 5/6 and
was structurally wrong. A boolean records *that* someone is fetching but connects you to **nothing** —
the other callers were waiting on an unrelated timer, so when the RPC threw, four of them woke up,
read an empty map and returned `undefined` as a nonce. Also: the 200ms was never reset, so every
later call paid it forever (3 sequential calls = 624ms; the fixed version runs all 6 tests in 242ms).
⚠️ Fourth appearance of my recurring bug, mutated: `200` is a hand-typed number that has to stay
bigger than a latency I don't control.

**The fix: cache the promise, not a flag.** Three load-bearing parts —
(1) `inflight: Map<string, Promise<number>>`, so all 50 callers `await` the same promise object;
(2) **re-check `has()` after the await** — all 50 passed the first check, so all 50 are inside the
block, and an unconditional `set()` re-seeds 7 for everyone;
(3) delete the entry on settle, or a rejected promise is cached forever and nothing ever retries
(plus a trailing `.catch(() => {})`, because `.finally()` returns a *new* promise nobody awaits and
an unhandled rejection is fatal by default since Node 15).

Earlier: solved 05. Big realisation: the monitor does NOT observe the producer — it probes the shared event
loop, so my own timer's lateness IS everyone's lateness. Got properly stuck on ref/unref: I thought
"stop() must leave nothing scheduled" and "a forgotten monitor must not hold the process open"
contradicted each other, and hacked a self-destruct timer. They're orthogonal: clearInterval controls
whether it RUNS, unref controls whether it keeps NODE ALIVE.
⚠️ Third repeat of my one recurring bug: hardcoded `10` instead of the `intervalMs` parameter, and the
tests still passed. Watch for literals that duplicate something already named. See 05/NOTES.md.

Earlier: solved 02. Diagnosis was right first try (sync hashing on the JS thread, `async` is irrelevant).
Two things I got wrong: (1) I thought libuv handled `createHash` — it doesn't, only the *slow*
async crypto goes to the pool; (2) my batch count used a hardcoded `10` while `BATCH_SIZE` was
`1000`, so 19,800 of 20,000 iterations did nothing but still awaited a timer → 22s instead of 300ms.
New model acquired: Node's loop has **phases** (timers → poll → check), `await` of a resolved promise
is a microtask and gives the loop NO turn, `setImmediate` (check phase) is 220× cheaper than
`setTimeout(0)` (1ms clamp). See 02/NOTES.md.

Earlier: solved 01. My string-surgery approach was right, but 6 of 7 bugs were index-arithmetic
special cases: no dot in the string, a leading "-", a number shorter than `decimals`,
an all-zero fraction. Root cause: `getDecimalIndex` returns `value.length` as a
"not found" sentinel, and I forgot to check for it when computing the fraction length.
Takeaway to carry forward: `split(".")`, `padStart`, `padEnd` don't remove the thinking,
they remove the boundaries where that bug class lives.

## 🪵 Session log (newest first, one line each)

| Date | Units done | What |
|---|---|---|
| 2026-11-02 | — | Company closing in 1–2 months → depth over speed. Reset PS0 01–05 to starters for a self-solved rebuild pass; old solutions + all NOTES moved to .solutions/ (gitignored). First commit of everything. |
| 2026-10-29 | 1 | Re-entry after 7 days. 01–05 still 25/25. Read 2.0c and wrote notes beside the doc (first doc-notes file). Step 4 done. |
| 2026-10-22 | 2 | Solved 04 (5/5; pool 309→208ms) + full debrief. Diagnosis mine, pool implementation Claude's. PS0 now 5/8. |
| 2026-10-21 | 1 | Re-entry after 5 days. 03 still 6/6. Wrote 03/NOTES.md Q2 (+3 corrections). Opened 04, no prediction yet — out of energy. |
| 2026-10-16 | 1 | 03 green, 6/6. Diagnosed the boolean-flag flaw myself; Claude wrote the promise-cache version. Debrief still owed. Skipped the 2.0b re-read (redundant). |
| 2026-10-14 | 2 | Solved 05 (4/4) + debrief. Deep dives: ref/unref, monotonic vs wall clock. Added --test-force-exit to check.ts. |
| 2026-10-12 | 2 | New laptop setup (Node 24 via nvm, .nvmrc added). Read 2.0b. Solved 02, 2/2 green + debrief. |
| 2026-10-09 | 3 | Read 2.0a (+ context-switching section). Solved 01, 8/8 green. Debrief written. |
| 2026-10-09 | — | Set up the plan and the practice track. Nothing solved yet. |
