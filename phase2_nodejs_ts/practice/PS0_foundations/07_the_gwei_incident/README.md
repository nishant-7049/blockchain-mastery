# 07 — The Gwei Incident

**Difficulty:** ★★☆ · **Concept:** structural typing, types are erased at runtime, branded types, smart constructors

---

## 🚨 The Incident

A refund job was supposed to send users `30 gwei × gasUsed` in wei. Someone passed the **gwei** value straight into
`sendTransaction(to, valueInWei)`. TypeScript didn't complain, because both values are `bigint`.
Users got refunds a billion times too small. Earlier the same week, a raw `"0xabc"` string ended up in a `to` field.

The postmortem action item: **"make the compiler catch unit mix-ups."**

## 🎯 Your Task

Edit **only** `units.ts`. The file `usage.ts` contains correct code and lines marked `// @ts-expect-error`.
You're done when:

- every `@ts-expect-error` line **is** a compile error (if a marked line compiles, `tsc` fails the build), and
- every unmarked line compiles cleanly, and
- at runtime a `Wei` **is still just a `bigint`** and an `Address` is just a `string`: no wrapper objects, no classes, zero cost.

Required API (the types are yours to design):

| Export | Behaviour |
|---|---|
| `wei(n)`, `gwei(n)` | tag a raw `bigint` with its unit |
| `gweiToWei(g)` | convert (1 gwei = 10⁹ wei) |
| `addWei(a, b)` | add two Wei values; Gwei must be rejected by the compiler |
| `toAddress(s)` | **validate** (`0x` + 40 hex chars, any case), return it **lowercased**, throw otherwise |
| `sendTransaction(to, value)` | returns the string `` `send ${value} wei to ${to}` `` |

```bash
npm run check 07      # runs tsc on usage.ts + runtime tests
```

Don't edit `usage.ts`. The test checks it hasn't changed.

## 🧠 Concept Briefing

Re-read *"Structural vs Nominal Typing"* and *"TypeScript Does Not Exist at Runtime"* in `docs/foundation/2_0e_why_typescript.md`.

- Structural typing means two types with the same *shape* are interchangeable. `type Wei = bigint` is only an alias.
- To make `Wei` and `Gwei` different to the compiler, their **shapes** must differ, but only in the type system.
- The only way to get a branded value should be through a function that checks the value (a *smart constructor*).

<details><summary>Hint 1</summary>

An intersection type: `bigint & { something only Wei has }`. Nothing at runtime needs to own that property,
because the compiler never checks it at runtime.
</details>

<details><summary>Hint 2</summary>

`declare const brand: unique symbol;` creates a key that no other code can write by accident. `declare` means it emits no JS.
</details>

<details><summary>Hint 3</summary>

Inside the constructor you'll need `as Wei`. That cast is the one allowed place where you vouch for a value.
</details>

## 🔍 Debrief

1. Why can a `Wei` still be passed to a function that takes a plain `bigint`, but not the other way round?
2. Run `node -e "console.log(typeof require('./units.ts').wei(1n))"` or similar. Where did the brand go?
3. Brands protect you from *your* mistakes. Why don't they protect you from bad data in a JSON request body? What does? (zod, coming later.)
4. `wei(5n) + wei(1n)`: what type does TS give the result, and is that a hole in the protection?
