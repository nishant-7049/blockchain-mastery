# 2.0e — Why TypeScript

---

## The Problem with JavaScript

JS was designed in 10 days for small browser scripts. It has no types — everything is figured out at runtime:

```javascript
function getUser(id) {
    return fetch(`/users/${id}`).then(r => r.json());
}

getUser("abc123");  // fine
getUser(null);      // runs, probably breaks at runtime
getUser();          // runs, sends /users/undefined, breaks silently
```

No error until your code is running in production. Three core problems at scale:

1. **No type safety** — wrong types surface as runtime errors, not editor errors
2. **No autocomplete / discoverability** — editor can't tell you what properties exist without running the code
3. **Refactoring is dangerous** — rename a parameter and you don't know what breaks until you manually test every path

---

## What TypeScript Is

TypeScript is a **superset of JavaScript** — every valid JS file is valid TS. It adds a type system that exists only at development time:

```typescript
function getUser(id: string): Promise<User> {
    return fetch(`/users/${id}`).then(r => r.json());
}

getUser(null);   // ❌ TypeScript error at compile time — before you ship
getUser();       // ❌ TypeScript error at compile time
getUser("abc");  // ✅
```

Type errors appear in your editor as you type — not in production, not in tests.

---

## TypeScript Does Not Exist at Runtime

All type annotations are **stripped out** by the compiler. Node.js never sees types — it only runs the compiled JS.

```typescript
// what you write (.ts)
const amount: bigint = 1000n;
function transfer(to: string, value: bigint): void { ... }
```

```javascript
// what actually runs (.js after tsc)
const amount = 1000n;
function transfer(to, value) { ... }
```

TypeScript is a **development tool**, not a runtime feature.

---

## How `tsc` Works

```
your .ts files
      ↓
   tsc (TypeScript Compiler)
      ├── type checks (finds errors)
      └── strips types → outputs .js files
            ↓
         Node.js runs the .js files
```

`tsc` does two jobs in one pass:
1. **Type checking** — finds type errors and reports them
2. **Transpilation** — removes all TS syntax, outputs valid JS

If there are type errors, `tsc` still outputs JS by default. This lets you incrementally add types to an existing JS project.

---

## tsconfig.json — The Key Options

```json
{
  "compilerOptions": {
    "target": "ES2022",        // what JS version to output
    "module": "NodeNext",      // module system (NodeNext = ESM for Node.js)
    "outDir": "./dist",        // where compiled JS goes
    "rootDir": "./src",        // where your TS source is
    "strict": true,            // enables all strict type checks — always use this
    "esModuleInterop": true,   // lets you import CJS packages cleanly
    "resolveJsonModule": true, // lets you import .json files
    "declaration": true,       // generates .d.ts type declaration files
    "sourceMap": true          // generates source maps for debugging
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`"strict": true`** is the most important. It enables:
- `strictNullChecks` — `null` and `undefined` are not valid values unless explicitly typed
- `noImplicitAny` — every variable must have a type, no silent `any`
- Several other checks

Without `strict: true`, TypeScript is much weaker. Always turn it on.

---

## Structural vs Nominal Typing

Most typed languages (Java, C#) use **nominal typing** — two types are compatible only if they share the same name:

```java
// Java
class Dog { String name; }
class Cat { String name; }

Dog d = new Cat(); // ❌ wrong type name, even though shape is identical
```

TypeScript uses **structural typing** — two types are compatible if they have the same shape, regardless of name:

```typescript
type Dog = { name: string };
type Cat = { name: string };

const cat: Cat = { name: "Whiskers" };
const dog: Dog = cat;  // ✅ same shape → compatible
```

This works with JS idioms — JS objects are open and duck-typed by nature.

```typescript
type Token = { address: string; decimals: number };

// any object with at least these fields is a valid Token
const usdc = { address: "0xA0b...", decimals: 6, symbol: "USDC" };
const t: Token = usdc;  // ✅ has required fields, extra fields are fine
```

---

## require vs import — the practical difference

`require` is a function call that happens at runtime (CJS):
```javascript
const express = require('express');  // Node loads the file right now, synchronously

// can be conditional
if (someCondition) {
    const tool = require('some-tool');
}
```

`import` is a language statement resolved before your code runs (ESM):
```javascript
import express from 'express';  // must be at top level, resolved before execution

// cannot be conditional — this is a syntax error:
if (someCondition) {
    import tool from 'some-tool'; // ❌
}
```

In TypeScript projects you'll always use `import`. The compiler handles the translation to whatever module format you configure. The distinction matters when things break — error like `"Cannot use import statement"` or `"require is not defined"` means a CJS/ESM mismatch.
