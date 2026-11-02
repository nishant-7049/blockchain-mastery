# 08 — Strategy Plugins

**Difficulty:** ★★★ · **Concept:** CommonJS vs ESM for real, `import()` of CJS, module caches, specifiers are URLs

---

## 🚨 The Situation

Your DEX aggregator loads **routing strategies** as plugins from a folder, so each team can ship one
without touching the core service:

```
strategies #1/
├── a-uniswap.mjs     ← ESM, `export default { name, quote }`
├── b-curve.cjs       ← legacy team, `module.exports = { name, quote }`
├── c-balancer.mjs    ← ESM with top-level await, `export const strategy = {...}`
├── d-legacy.cjs      ← `exports.strategy = {...}`
└── NOTES.md
```

The current loader (`loader.ts`) was written back when everything was CJS. It crashes on startup.
Ops also wants a **hot reload** endpoint so a strategy file can be edited without restarting the service.
The first attempt at that "reloads" and keeps running the old code.

## 🎯 Your Task

Implement both functions in `loader.ts`:

**`loadStrategies(dir)`**
- Load every `.mjs` and `.cjs` file in `dir`, in filename order. Ignore all other files.
- Accept all four export styles shown above.
- Validate the result: `name` must be a string and `quote` a function. Otherwise throw an `Error` whose message
  **includes the filename**, so ops can see which plugin is broken.
- It must work when the directory path contains spaces or `#`.

**`reloadStrategies(dir)`**
- Same contract, but it must pick up **changes made to the files on disk** since the last load, for both `.mjs` and `.cjs`.

```bash
npm run check 08
```

## 🧠 Concept Briefing

Re-read *"CommonJS vs ESM"* in `docs/foundation/2_0d_node_ecosystem.md`. Then check these claims yourself in a scratch file,
because some of them changed after that doc was written:

- Node 22.12+ **can** `require()` an ES module, with one big exception. Which one? (Look at `c-balancer.mjs`.)
- `import()` of a CJS file works. What does the resulting namespace object look like? Where does `module.exports` end up?
- `import()` takes a **URL**, not a file path. What does `#` mean in a URL?
- Both module systems **cache** what they load. How do you get around each cache?

<details><summary>Hint 1</summary>

Use `import()` for everything. For CJS, `module.exports` shows up as `namespace.default`.
Named exports like `exports.strategy` *may* also be detected, but don't count on it.
</details>

<details><summary>Hint 2</summary>

`pathToFileURL(path).href` from `node:url` turns a path with `#` or spaces into a valid specifier.
</details>

<details><summary>Hint 3</summary>

The ESM cache is keyed by the full URL, **including the query string**, and nothing can clear it.
A CJS file loaded through `import()` also passes through `require.cache`. Test whether a new query string is enough on its own.
</details>

## 🔍 Debrief

1. Why can't Node let you `require()` an ESM module that uses top-level `await`?
2. Cache-busting with `?v=` means the old module version **stays in memory forever**. Why does that make hot reload in
   a long-running process a memory leak? How do production systems avoid it? (Think: restart the worker, or run plugins in a `worker_thread` / `vm` context.)
3. Loading a JS file from disk and executing it is `eval` with extra steps. What's the security implication of a plugin folder?
