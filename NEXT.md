# NEXT

> The only file that matters when you sit down. Update it in the **last 2 minutes** of every session.
> Coming back after a break? Follow the Re-entry Protocol in `STUDY_PLAN.md`, not your memory.

## 🎯 Right now

**Two things, in this order.**

**1. Close 01 (5 minutes).** `01_the_missing_wei/NOTES.md` is written but **Q3 is TODO**:

```bash
node -e "console.log(JSON.stringify({ v: 1n }))"
```

Why is that a problem for an API returning balances? Where does it bite in a real backend (DB hands
you a `bigint`, handler does `res.json({ balance })`, then what)? And if you "fix" it the obvious way,
what have you just done to the client that reads the number? Answer it, and 01 is fully closed.

**2. CV + application pipeline (this session, not later).** Decided 2026-11-06, and the reason is lag,
not priority: applications convert on a 2–6 week delay, so sending the first batch this week costs no
learning time but pulls every offer two weeks earlier. Interviews also tell me *which* gaps matter —
right now I'm guessing it's Node internals; three screening calls would say whether it's that, system
design, DSA or Solidity. And writing "what have I built" shows exactly which project is missing.

Claude needs these to draft it (rough notes are fine, no formatting):
1. Work history — the company that closed: title, dates, what the product was, what **I** built. Plus earlier roles.
2. My actual day-to-day stack at work (MongoDB/DocumentDB + AWS are visible in my ssh config; what else?).
3. Education — degree, college, year.
4. Target — blockchain/Web3 backend or Node backend generally? Remote / India / relocation? Expected range?
5. Existing material — old CV, LinkedIn, or nothing?

This repo is part of the pitch, not a side project: a documented study plan, incident-style problems
and written debriefs is unusual evidence. It should be visible, not buried.

**Then** back to the rebuild pass: **02 — The Frozen Indexer**. Learning continues at 2–3 units/day
alongside a small daily application slice; it does not pause for the job hunt.

```bash
cd phase2_nodejs_ts/practice
nvm use
npm run check 02
```

⚠️ `.solutions/` holds pass-one answers. 01's is now fair game (01 is solved); 02–05 are not.

## 📅 This Saturday

**Sat 2026-11-07** — derive it on the day (STUDY_PLAN rule). If the rebuild pass is still running,
Saturday takes whichever of 03/04 is next: those are the two that actually need an unbroken block.
Once the rebuild is done, Saturday goes back to **08 (Strategy Plugins)**, ★★★, with 2.0d read first.
**06 (Merkle)** wants 2.0f (TypeScript's Type System), which **does not exist yet** — flag it then.

## 🧠 Where my head was

**01 is solved, genuinely mine this time.** 8/8 tests plus 22 extra probes, both functions written
start to finish, `formatUnits` rewritten from scratch with no hints. Six bugs along the way and I
fixed all six myself; **three of the six were invisible to the test suite** (interior zeros dropped,
`BigInt(-prefix)` coercing a string to a float, and an early return that skipped the sign
re-attachment). Every `formatUnits` test uses decimals 18 or 6 against longer numbers, so small
`decimals` is a completely untested region — green tests are not the finish line.

Newest variant of my recurring bug: **an early return that bypasses a step every other path takes.**
And the one to remember: I spent two days learning a `number` can't hold 10¹⁸ wei, then a single `-`
in front of a string sent the value through a `number` anyway. **Coercion is invisible.**


**IEEE-754, properly this time.** Last pass I went straight to string surgery and skipped the *why*.
Now I can derive the 128-wei error from first principles:
- A double is 8 bytes = **1 sign + 11 exponent + 52 mantissa**. Only the mantissa holds precision
  (53 significant bits, because the leading `1` is implicit and free — that's why MAX_SAFE_INTEGER is
  2⁵³−1, not 2⁵²−1). The exponent holds **scale**, not digits. Stored biased: `actual + 1023`;
  stored `0` → zero/subnormals (no implicit 1), stored `2047` → Infinity/NaN.
- `value = (-1)^sign × 1.mantissa × 2^(storedExp − 1023)`. Gap between neighbours = **2^(exp − 52)**.
  At exp 0 → 2⁻⁵²; at exp 53 → 2 (odd integers vanish); at exp 59 → **128**; at exp 60 → 256.
- My real mistake was **thinking in decimal**. `1.15 = 23/20`, and 20 = 2²×**5**; binary has no 5s, so
  it repeats forever like ⅓ in decimal. Stored value is 1.1499999999999999111821580299875…
- Two failures compose: (1) `parseFloat` is *already* lossy — `console.log` hides it by printing the
  shortest string that round-trips; (2) the product is then snapped to the 128-grid. And the sting:
  `1150000000000000000` **is** representable — the inherited error just pushed it nearer the wrong
  grid point, and rounding locked that in.
- Floats round (nearest, ties-to-even), they don't truncate, and they never warn. `BigInt` **throws**
  instead of lying. Nothing ever overflows memory — 8 bytes always; overflow is only at ~1.8e308.

**Regex basics learned** (for the validation gate): `^`/`$` anchor to the whole string — without them
`.test(" 1")` finds `1` *inside* and returns true; `[0-9]`/`\d`; `?` `*` `+` `{n}`; `\.` because a bare
`.` is any character; `(?: )` for non-capturing groups; `|` has the lowest precedence so it needs
parentheses; capture groups can hand back the pieces, so one regex can validate *and* split.

**TypeScript earned its keep**: `split(ai+2)` was a compile error because `split` takes a separator,
not a position (`slice` does positions). In plain JS it would have coerced to `"1"` and split on the
character `1` — silently wrong, an hour lost. That's problem 07's whole argument.


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
| 2026-11-06 | 2 | **01 SOLVED** (8/8 + 22 probes), all 6 bugs fixed by me. Debrief written (Q3 open). Decided: CV + applications start now, in parallel with the rebuild pass. |
| 2026-11-04 | 1 | Rewrote parseUnits/formatUnits myself (split/pad/sign logic). 6/8 green. Claude found 4 bugs incl. 2 the suite misses: interior zeros dropped, and `-prefix` coercing a string to a float inside the float-free function. Fixes left to me. |
| 2026-11-03 | 2 | Company now closed → full-time learning. Deep dive on IEEE-754 (exponent/mantissa/bias/ulp) + regex basics. Wrote isValidNumber + formatUnits; parseUnits structurally wrong, left mid-problem on purpose. |
| 2026-11-02 | — | Company closing in 1–2 months → depth over speed. Reset PS0 01–05 to starters for a self-solved rebuild pass; old solutions + all NOTES moved to .solutions/ (gitignored). First commit of everything. |
| 2026-10-29 | 1 | Re-entry after 7 days. 01–05 still 25/25. Read 2.0c and wrote notes beside the doc (first doc-notes file). Step 4 done. |
| 2026-10-22 | 2 | Solved 04 (5/5; pool 309→208ms) + full debrief. Diagnosis mine, pool implementation Claude's. PS0 now 5/8. |
| 2026-10-21 | 1 | Re-entry after 5 days. 03 still 6/6. Wrote 03/NOTES.md Q2 (+3 corrections). Opened 04, no prediction yet — out of energy. |
| 2026-10-16 | 1 | 03 green, 6/6. Diagnosed the boolean-flag flaw myself; Claude wrote the promise-cache version. Debrief still owed. Skipped the 2.0b re-read (redundant). |
| 2026-10-14 | 2 | Solved 05 (4/4) + debrief. Deep dives: ref/unref, monotonic vs wall clock. Added --test-force-exit to check.ts. |
| 2026-10-12 | 2 | New laptop setup (Node 24 via nvm, .nvmrc added). Read 2.0b. Solved 02, 2/2 green + debrief. |
| 2026-10-09 | 3 | Read 2.0a (+ context-switching section). Solved 01, 8/8 green. Debrief written. |
| 2026-10-09 | — | Set up the plan and the practice track. Nothing solved yet. |
