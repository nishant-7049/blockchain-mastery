# 2.0d — The Node Ecosystem

---

## Package Managers (npm / yarn / pnpm)

When you install a library, something has to:
- Fetch it from a registry (npmjs.com)
- Resolve its dependencies (and their dependencies)
- Store it on disk
- Track what's installed so others can reproduce it

That's what package managers do.

- **npm** — comes bundled with Node. The original. Still the most common.
- **yarn** — built by Facebook in 2016. Introduced `yarn.lock` (deterministic installs) and offline caching. npm later caught up.
- **pnpm** — the modern default for serious projects. Solves the node_modules problem.

---

## The node_modules Problem

When you `npm install`, every package gets its own copy of its dependencies inside `node_modules/`:

```
your-project/node_modules/
├── express/
│   └── node_modules/
│       ├── accepts/
│       └── body-parser/
├── axios/
│   └── node_modules/
│       └── follow-redirects/   ← same package, different copy
└── viem/
    └── node_modules/
        └── ...  ← could be gigabytes
```

A typical blockchain project's `node_modules` can be **500MB–1GB** — mostly duplicated packages.

**pnpm's solution — a global content-addressable store:**

```
~/.pnpm-store/
├── lodash@4.17.21/   ← stored ONCE globally
└── viem@2.0.0/       ← stored ONCE globally

your-project/node_modules/
├── lodash → symlink to ~/.pnpm-store/lodash@4.17.21
└── viem   → symlink to ~/.pnpm-store/viem@2.0.0
```

Same package across 10 projects? Stored once, symlinked everywhere. Faster installs, fraction of the disk usage.

---

## The Lockfile

Every package manager generates a lockfile:

| Manager | Lockfile |
|---|---|
| npm | `package-lock.json` |
| yarn | `yarn.lock` |
| pnpm | `pnpm-lock.yaml` |

The lockfile records the **exact version** of every installed package including transitive dependencies. Without it, `npm install` on two machines might install different versions if a dependency released a patch between installs.

**Rule: always commit the lockfile. Never commit `node_modules/`.**

---

## CommonJS vs ESM — Why Two Module Systems

**CommonJS (CJS)** — Node's original module system, built in 2009:

```javascript
// exporting
const add = (a, b) => a + b;
module.exports = { add };

// importing
const { add } = require('./math');
```

`require()` is **synchronous** — reads the file and executes it immediately.

**ESM (ES Modules)** — the official JavaScript standard, added to the spec in 2015, supported in Node from v12:

```javascript
// exporting
export const add = (a, b) => a + b;

// importing
import { add } from './math.js';
```

`import` is **static and asynchronous** — the module graph is resolved before execution, enabling tree-shaking (bundlers can eliminate unused exports).

**Why two systems exist:**

Node was built years before JS had an official module system. When ESM landed, Node had to support both without breaking millions of existing CJS packages. The result: an awkward coexistence.

**Compatibility rules that matter:**

```
CJS can require() CJS     ✅
ESM can import ESM        ✅
ESM can import CJS        ✅ (with some caveats)
CJS cannot require() ESM  ❌ (require is sync, ESM loading is async)
```

That last one is where it bites you. If a package ships ESM-only (`node-fetch` v3, `chalk` v5, `ora` v6), you can't `require()` it in a CJS file. You must use dynamic `import()` or convert your project to ESM.

**How Node decides which system to use:**

```
file.mjs      → always ESM
file.cjs      → always CJS
file.js       → depends on nearest package.json:
    "type": "module"    → ESM
    "type": "commonjs"  → CJS (default if omitted)
```

In TypeScript projects you'll set `"module": "NodeNext"` in tsconfig — the compiler handles the translation.

---

## Monorepos

A monorepo is a single git repository containing multiple packages/apps.

```
blockchain-project/          ← one git repo
├── packages/
│   ├── contracts/           ← Solidity contracts
│   ├── sdk/                 ← TypeScript SDK wrapping contracts
│   └── shared/              ← shared types, utils
├── apps/
│   ├── api/                 ← Express backend
│   └── frontend/            ← Next.js frontend
└── package.json             ← workspace root
```

**Why:**
- `sdk` depends on types from `contracts` — reference locally, no need to publish to npm
- One git history, one PR, one CI pipeline
- Shared tooling config (ESLint, TypeScript, prettier) at the root

**How — workspaces:**

npm, yarn, and pnpm all support workspaces natively:

```json
// root package.json
{
  "workspaces": ["packages/*", "apps/*"]
}
```

`pnpm install` at the root installs all dependencies across packages, deduplicating. `pnpm --filter sdk build` runs the build only in the `sdk` package.

Most serious blockchain projects (Uniswap, Aave, OpenZeppelin) use monorepos. Phase 2 projects will use a simple single-package setup, but you'll encounter this in production.
