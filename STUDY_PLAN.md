# Study Plan — How I Work Through This

> The roadmap says *what* to learn. This file says *how*, so it survives breaks and busy weeks.
> Rules first, schedule second. If a rule and an ambition conflict, the rule wins.

---

## The 4 Rules

**1. One main track at a time.**
Right now the main track is **Phase 2 (Node.js + TS)**. Not Rust "on the side", not a second repo.
At most **one book** is active alongside it, and books are **weekend-only**. That's it. Two things, never three.

**2. Weekdays are measured in units, not hours.**
A **unit** is one of:
- one lesson doc read properly (not skimmed), or
- one practice problem solved until tests pass, or
- one debrief written in `NOTES.md`, or
- one meaningful chunk of project code (one class, one endpoint, one test file).

**1–2 units per weekday.** A 20-minute unit still counts. The number of units is the only metric.

**Weekdays take the small, finishable units. Saturday takes whatever can't be cut into small pieces** —
the ★★★ practice problems and, later, project work (design first, then code, then tests).

**3. Never end a session without writing the next action.**
Last 2 minutes of every session: update `NEXT.md` with the *specific* next action.
Not "continue Node", but "solve problem 03, I think the bug is that both callers see an empty map".
This is the single thing that protects you from the "lost momentum" death.

**4. Breaks are expected. Restarts are scripted.**
Missing days is not failure, and not re-entering is. See **Re-entry Protocol** below.
You never restart a phase. You resume from `NEXT.md`.

---

## The Weekly Shape

| When | What | Size |
|---|---|---|
| **Mon–Fri** | Main track only (Phase 2 roadmap + practice problems) | 1–2 units/day |
| **Saturday** | Main track, long block: project code, or the hardest practice problem | 3–4 hrs |
| **Sunday** | Book block (OOD now, Coding Patterns later) + update `NEXT.md` for the week | 2–3 hrs |

Sunday is deliberately **not** roadmap work. It's the pressure valve: if the week went badly you don't
feel you're behind on two things at once.

### Picking Saturday's item (don't plan it, derive it)

Apply in order and stop at the first match:

1. **Something Saturday-sized is half-finished?** Continue it. Never have two big things open at once.
2. **The next item in the main-track order needs an unbroken block?** Take it.
   In PS0 that means problems **06** and **08**; later it means project work.
3. **Nothing big is due yet?** Saturday becomes a batch of 3–4 weekday units, which buys you slack
   for the week you inevitably lose to work.

On Sunday, write the result as one line in `NEXT.md`: `This Saturday: …`.
That one line is the entire planning process. Never plan further than the coming Saturday.

### Saturday-sized chunks for projects (P2.1 onward)

A project is never "one Saturday". Split every project the same way, one chunk per Saturday:

| Chunk | What |
|---|---|
| **Sat A** | LLD docs only: `requirements.md`, class diagram, API design. **No implementation code.** |
| **Sat B** | Core implementation against that design |
| **Sat C** | Tests, error paths, README; note where the design was wrong |

Weekdays keep running alongside: one class, one endpoint or one test file is a perfectly good weekday unit.
A project only starts once the milestones it depends on are done (P2.1 needs 2.1–2.2; see the roadmap table).

---

### Weekday unit routine (from the practice track)

```
read lesson → predict why the starter fails → run tests → solve → debrief in NOTES.md
```

Steps 2 and 5 are the ones that make it stick. Never skip the prediction.

---

## Books — strictly one at a time

**Now: ByteByteGo — Object-Oriented Design Interview.** One chapter per Sunday.
It isn't separate from the roadmap: it *is* milestones 2.4 (Design Patterns) and 2.5 (LLD Concepts).
After each chapter, apply it to code you already own rather than just reading it:

| Chapter topic | Apply immediately to |
|---|---|
| SOLID, class design | `phase1_5_solidity/contracts_dev/` — which contract violates SRP? |
| Design patterns | Practice problem 08 (plugin loading is Strategy + Factory) |
| Class/sequence diagrams | Draw them for project P2.1 **before** writing it |
| Concurrency / state machines | Practice problems 03 and 04 |

**Later: ByteByteGo — Coding Patterns.** Do **not** start it until the OOD book is finished.
When it starts, it takes over the Sunday slot: 2–3 problems per Sunday, forever, as a background habit.
These need spaced repetition over months, so slow and continuous beats a cram sprint.

---

## Doc backlog (corrections to fold into *future* docs, not retrofitted)

Docs already read stay as they are — rewriting them is re-reading, which is how momentum dies.
Corrections that come up go here and land in the doc where the topic gets its real depth:

| Correction | Lands in |
|---|---|
| Node's loop **phases** (timers → pending → poll → check → close) and why `setImmediate` ≠ `setTimeout(0)`. 2.0b's single "macrotask queue" is the browser-simplified model. | **2.2 Async Mastery** |
| `process.nextTick` vs microtasks vs macrotasks, and nextTick starvation | **2.2 Async Mastery** |
| libuv thread pool: default 4, used by fs + DNS + slow crypto; `epoll` can't take regular files (`EPERM`); `io_uring` in libuv 1.45+/Node 20+ | **2.2 Async Mastery** |

---

## Re-entry Protocol (after any break ≥ 3 days)

Do this in order. It takes 20 minutes. Do **not** read ahead, re-plan, or restart a phase.

1. Open `NEXT.md`. Read your own last note.
2. Re-run the last thing you were working on: `npm run check NN` in `phase2_nodejs_ts/practice`. Watch it fail or pass.
3. Re-read **only** the last `NOTES.md` you wrote, nothing else.
   (None yet? Use the "Where my head was" section of `NEXT.md` instead.)
4. Do **one** unit. The smallest one available. Finish it.
5. Update `NEXT.md`. Done for the day. You're back.

> After a long break the urge is to "start fresh from the beginning". That urge is what has cost you this
> roadmap several times. The fix is step 4: one small finished unit beats a fresh plan.

**Minimum day:** on a day when everything is on fire, the floor is **10 minutes**: re-read your last
`NOTES.md` and write one line in `NEXT.md`. That counts. The chain isn't broken.

---

## Where the interview prep fits

No date, by your call. It's triggered by **progress**, not by a calendar:

> **Trigger:** OOD book finished **and** projects P2.1–P2.3 built.
> **Then:** add a 4-week interview layer — Coding Patterns moves from Sunday-only to 3 weekdays,
> and you write an LLD doc for one project as if presenting it.

Until that trigger, interviews are not something you worry about. Depth now, packaging later.

---

## Progress, visibly

- **`NEXT.md`** — the only file that always tells you what to do right now. Updated every session.
- **`NOTES.md`** — *you* create one **inside a problem folder** when that problem's tests pass, holding your
  debrief answers. One per problem, written once. It is **not**
  a session-closing file: that's `NEXT.md`'s job.
  For a doc with no practice problem (2.0c), the notes go **next to the doc** as
  `<doc-name>.NOTES.md`, and hold what the doc got wrong or left out *measured against problems already
  solved* — read every doc from here on against your own code, not flat.
- **Practice checkboxes** — `phase2_nodejs_ts/practice/README.md` has a ⬜/✅ column per problem.
- **`ROADMAP.md` tracker** — updated when a milestone completes, not daily.
- **Git** — commit at the end of every session, even a half-finished one. `git log` is your real progress bar.

---

## Current Order of Work (Phase 2)

| Step | Read | Then solve |
|---|---|---|
| 1 | 2.0a Why Node.js Exists | Practice 01 — The Missing Wei |
| 2 | 2.0b Node.js Architecture | Practice 02 → 05 |
| 3 | Re-read the `async/await` part of 2.0b | Practice 03 → 04 |
| 4 | 2.0c Node vs Others | No new problem — answer problem 02's debrief |
| 5 | 2.0d The Node Ecosystem | Practice 08 |
| 6 | 2.0e Why TypeScript | Practice 07 |
| 7 | 2.0f TypeScript's Type System *(doc not written yet)* | Practice 06 (Merkle + Buffers) |
| 8 | Milestone 2.1 → 2.7, each with its own practice set | PS1, PS2 … |
| 9 | Projects P2.1 → P2.6, LLD docs first | — |

After each practice problem passes, tick its box in the practice README.
