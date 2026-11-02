# 01 — The Missing Wei

**Difficulty:** ★☆☆ · **Concept:** JavaScript numbers (IEEE-754 doubles), `bigint`, why money is never a float

---

## 🚨 The Incident

A user withdraws `1.15` ETH from your exchange's hot wallet. The on-chain transaction sends
`1149999999999999872` wei, not `1150000000000000000`. The user opens a support ticket over the missing
128 wei. Finance then finds that **every** withdrawal since launch is off by a few wei, and the
books no longer reconcile.

This is the conversion code that shipped:

```ts
export function parseUnits(value: string, decimals: number): bigint {
  return BigInt(Math.round(parseFloat(value) * 10 ** decimals));
}
```

## 🎯 Your Task

Rewrite both functions in `units.ts` so they are **exact** for every input:

| Function | Example |
|---|---|
| `parseUnits("1.15", 18)` | `1150000000000000000n` |
| `parseUnits("-0.5", 6)` | `-500000n` |
| `formatUnits(1150000000000000000n, 18)` | `"1.15"` |
| `formatUnits(1000000n, 6)` | `"1"` (no trailing `.0`) |
| `formatUnits(-1n, 18)` | `"-0.000000000000000001"` |

Rules:
- `parseUnits` must **throw** on garbage: `""`, `"-"`, `"."`, `"1.2.3"`, `"1e18"`, `"abc"`, `" 1"`.
- `parseUnits` must **throw** when the input has more decimal places than `decimals`. Rounding away
  someone's money without saying so is a bug.
- `"1."` and `".5"` are allowed and mean `1` and `0.5`.
- You may **not** use `Number`, `parseFloat`, `parseInt`, or `Math.*` anywhere in the conversion.

```bash
npm run check 01
```

## 🧠 Concept Briefing (read before you start)

- Every JS `number` is a 64-bit float. It can store integers exactly only up to
  `Number.MAX_SAFE_INTEGER` (2⁵³ − 1 ≈ 9·10¹⁵). One ETH is 10¹⁸ wei.
- Some decimal fractions, like `0.1` and `1.15`, have **no** exact binary representation. Run `0.1 + 0.2` in `node`.
- `bigint` is an arbitrary-precision integer, written like `10n`. It never loses precision, but it has
  no decimals. `10n / 3n === 3n`.

<details><summary>Hint 1</summary>

Never turn the string into a number. Treat it as **text**: split it into a whole part and a fraction part.
</details>

<details><summary>Hint 2</summary>

`"1.15"` with 18 decimals is the integer `"1" + "15".padEnd(18, "0")`. Build that string, then call `BigInt()` on it.
</details>

<details><summary>Hint 3</summary>

For `formatUnits`, `%` and `/` on bigint give you the whole and fractional parts. Watch out for negatives
and leading zeros in the fraction.
</details>

## 🔍 Debrief (answer these in your own words once the tests pass)

1. Why is `1.15 * 1e18` not `1150000000000000000`? What is the *actual* double closest to 1.15?
2. `ethers.js` and `viem` both take amounts as **strings** or `bigint`, never `number`. Why?
3. Why is `JSON.stringify({ v: 1n })` a problem for an API that returns balances? How would you work around it?
