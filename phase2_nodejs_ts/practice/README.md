# Phase 2 — Node.js Practice Track

No "declare a variable" drills. Every problem here is a **situation**: a production incident, a broken
teammate prototype, or a feature ops needs. You can't solve it by pattern-matching syntax. You have to understand
the concept underneath. Then a test suite checks your work.

## How each problem works

```
NN_problem_name/
├── README.md        🚨 Incident → 🎯 Task → 🧠 Concept briefing → hints (collapsed) → 🔍 Debrief
├── <code>.ts        starter code: either buggy (the code that shipped) or a TODO stub
└── <code>.test.ts   the judge, don't edit
```

**The loop:**

1. Read the incident and the task. **Don't open the hints yet.**
2. Read the concept briefing. It points you at the doc section you need.
3. Predict *why* the starter code fails **before** running anything. Write the prediction down.
4. `npm run check 03` to see which tests fail. Were you right?
5. Solve it. Open a hint only after you've been stuck for real (≈20 min).
6. When it's green, answer the **Debrief** questions in a `NOTES.md` next to your solution.
   The problem isn't finished until you can explain *why* your fix works.

## Setup

```bash
cd phase2_nodejs_ts/practice
npm install          # only installs typescript + @types/node, no runtime deps
npm run check 01     # run one problem
npm test             # run everything
```

Requires Node ≥ 22.18 (it runs `.ts` files directly, with no build step). The repo has an `.nvmrc`,
so `nvm use` in the repo root picks the right version; on a fresh machine run `nvm install` first, then
`npm install` here (`node_modules` is not committed). Types are **not** checked at
runtime, so use your editor or `npm run typecheck` for that. `typecheck` reports errors in problems you haven't
solved yet, which is expected.

## PS0 — Foundations in Action (covers docs 2.0a–2.0e)

| # | Problem | Concept | ★ | Done |
|---|---------|---------|---|------|
| 01 | [The Missing Wei](PS0_foundations/01_the_missing_wei/) | IEEE-754 floats, `bigint`, exact money math | ★☆☆ | ✅ |
| 02 | [The Frozen Indexer](PS0_foundations/02_the_frozen_indexer/) | Blocking the event loop, microtask vs macrotask | ★★☆ | ⬜ |
| 03 | [Duplicate Nonces](PS0_foundations/03_duplicate_nonces/) | Interleaving at `await`, caching promises | ★★☆ | ⬜ |
| 04 | [Banned by the RPC Provider](PS0_foundations/04_rpc_rate_limit/) | Promises are eager, concurrency pools | ★★☆ | ⬜ |
| 05 | [Missed Slots](PS0_foundations/05_missed_slots/) | Timer guarantees, event loop lag, `unref` | ★★☆ | ⬜ |
| 06 | [Airdrop Merkle Proofs](PS0_foundations/06_airdrop_merkle_proofs/) | `Buffer`, bytes vs hex, `node:crypto` | ★★★ | ⬜ |
| 07 | [The Gwei Incident](PS0_foundations/07_the_gwei_incident/) | Structural typing, branded types | ★★☆ | ⬜ |
| 08 | [Strategy Plugins](PS0_foundations/08_strategy_plugins/) | CJS vs ESM, module caches, specifiers are URLs | ★★★ | ⬜ |

Coming next, following the roadmap: **PS1 — Async Mastery (2.2)**: streams and backpressure on a 2GB tx dump,
`nextTick` starvation, worker threads for signature verification, graceful shutdown of an indexer. **PS2 — TS type system (2.1)**:
typing an ABI so `contract.read("balanceOf")` infers its args and return type.
