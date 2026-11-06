# 01 — The Missing Wei · Debrief

Solved 2026-11-06 (rebuild pass). 8/8 tests, plus 22 extra probes covering cases the suite doesn't reach.
Both functions written by me start to finish; `formatUnits` rewritten from scratch with no hints.

---

## My takeaway (as I wrote it)

> Floats go wrong on big values. A float follows the IEEE-754 standard: its bytes are split into three
> parts — sign, exponent and mantissa. Arithmetic itself is done accurately, but when the result is
> stored in memory in binary it can only occupy the blocks it has, and the limit lives in the mantissa.
> When writing functions over bigint, remember negative values can be passed too. Also learned some
> basic regex because of this problem.

**One thing to sharpen:** "arithmetic is accurate, storage is not" is half the story. Each *individual*
operation is computed as if with infinite precision and then **rounded once** to the nearest
representable double (≤ ½ ulp of error — "correctly rounded"). But:

1. **The input conversion is itself one of those operations.** `parseFloat("1.15")` has already rounded
   before any multiplication happens. The number was wrong before the arithmetic started.
2. Errors **compound** across operations, and multiplication *magnifies* whatever error is already there.

So the fault wasn't "the multiply broke it" — my first diagnosis. The multiply scaled a 10⁻¹⁷ relative
error into a 128-wei absolute one, then snapped the result to a coarse grid.

---

## Q1 — Why isn't `1.15 * 1e18` equal to `1150000000000000000`?

### The layout

```
 1 bit   sign
11 bits  exponent    ← WHERE the number is (scale). Stored biased: actual + 1023.
52 bits  mantissa    ← the digits (53 significant: the leading 1 is implicit and free)
───────
64 bits  = 8 bytes, always

value = (-1)^sign × 1.mantissa × 2^(storedExp − 1023)
```

Reserved exponents: stored `0` → zero and subnormals (no implicit leading 1 — this is how `0.0` can
exist at all), stored `2047` → `Infinity` (mantissa 0) / `NaN` (mantissa ≠ 0). So normals run
−1022 … +1023. The bias exists so two doubles compared **as plain integers** sort in numeric order.

### Why 1.15 is not representable

My real mistake was **thinking in decimal**. Binary can only write fractions whose denominator is a
power of 2:

```
1.15 = 23/20,  and  20 = 2² × 5      ← the 5 is fatal; binary has no 5s
1.15 in binary = 1.001001100110011001100110011…   ("0011" forever, like ⅓ in decimal)
```

Chop at 53 significant bits and the stored value is

```
1.149999999999999911182158029987476766109466552734375      (low by 8.88e-17)
```

`console.log` prints `1.15` because it shows the **shortest decimal string that round-trips** to that
bit pattern. The printer hid the error from me — which is why my bisection "wrongly" cleared `parseFloat`.

### Why the result can't be fixed afterwards

```
stored double × 10^18 (exact math) = 1149999999999999911.182158…
grid near 1e18 …1149999999999999872 … 1150000000000000000…   spacing 128
                      ↑ 39 away            ↑ 89 away
result = 1149999999999999872                 error = 128 wei
```

**The sting:** `1150000000000000000` *is* representable — it's an exact multiple of 128. The right
answer was on the grid. The error inherited from `parseFloat` pushed the product nearer the wrong grid
point, and rounding locked it in.

### The resolution formula worth memorising

```
gap between neighbours (ulp) = 2^(actual exponent − 52)

exp  0  → 2⁻⁵²  ≈ 2.2e-16     near 1, ~16 decimal places
exp 53  → 2                   MAX_SAFE_INTEGER boundary: odd integers stop existing
exp 59  → 128                 my missing 128 wei
exp 60  → 256                 where 1.15e18 actually lives
```

Precision is **constant** (53 bits); *resolution* scales with magnitude. There's no fixed decimal place
where accuracy stops. And `0.01 ETH = 10¹⁶ wei` is **already past `MAX_SAFE_INTEGER`** — this isn't an
exotic-amounts problem.

Also: floats **round** (nearest, ties-to-even), they don't truncate, so the stored value can be above
the truth too (`0.1 + 0.2 = 0.30000000000000004`). Nothing ever runs out of memory — it's 8 bytes
before and after; real overflow only happens past ~1.8e308, where you get `Infinity`.

---

## Q2 — Why do ethers.js and viem take strings or `bigint`, never `number`?

Because `number` **cannot hold the values** and **fails silently**.

- A wei amount for anything above 0.01 ETH exceeds `MAX_SAFE_INTEGER`, so the type is wrong by design.
- `number` never reports the loss: no exception, no flag, just a slightly different value. `BigInt`
  **throws** instead of lying (`BigInt(1.5)` → `RangeError`). For money, refusing beats guessing.
- A **string** is the only lossless way to carry human decimal input ("1.15") into the system, because
  the digits never pass through a binary float. Both ends — the string and the `bigint` — are exact;
  only the middle would have been lossy.

Which is exactly the shape of the fix: `"1.15"` → string surgery → `"1150000000000000000"` → `BigInt`.
No `number` anywhere.

---

## Q3 — `JSON.stringify({ v: 1n })` — *TODO*

---

## What I actually got wrong this pass (and the pattern)

| # | Bug | Caught by tests? |
|---|---|---|
| 1 | truncated excess decimals instead of throwing — the incident itself | ✅ |
| 2 | `formatUnits` dropped zeros **inside** the fraction (`1.05` → `1.5`) | ❌ |
| 3 | `decimals === 0` → `slice(0, -1*0)` → `slice(0,0)` → `""` | ✅ |
| 4 | `BigInt(-prefix)` — unary `-` coerces a **string to a Number** | ❌ |
| 5 | throw boundary used `< 0` where `<= 0` was needed (equality is representable) | ✅ |
| 6 | early `return` for an all-zero fraction **skipped the sign re-attachment** | ❌ |

Four of those six are new instances of the one mistake I keep making:

- 01 (pass 1): `getDecimalIndex` sentinel not checked by its caller
- 02: `BATCH_SIZE = 1000` vs a hardcoded `10`
- 05: `intervalMs` vs a hardcoded `10`
- 03: `delay(200)` — a hand-typed number that must exceed a latency I don't control
- 04: `i` (chunk start) where the item's own index was required
- 01 (pass 2): the `< 0` / `<= 0` boundary, and an early return that skipped a mandatory final step

**Pattern: a value or code path that must agree with another, and doesn't.** The newest variant is the
nastiest: *an early return that bypasses a step every other path takes.*

**Bug 4 is the one to remember.** I spent two days learning that a `number` cannot hold 10¹⁸ wei, and
then a single `-` in front of a string sent the value through a `number` anyway. The lesson isn't the
rule, it's that **coercion is invisible** — `-someString` does not look like a float conversion.

**And 3 of 6 were invisible to the test suite.** All `formatUnits` tests use `decimals` of 18 or 6
against longer numbers, so small-`decimals` inputs are an entirely untested region. Green tests are
not the finish line; find the untested region yourself.

---

## Regex, learned here

```
^  $        anchor to the WHOLE string. Without them .test(" 1") finds "1" inside and returns true.
[0-9] \d    one character from a set (\d is ASCII 0-9 only in JS)
? * +       0-or-1, 0-or-more, 1-or-more   {n} {n,m} exact/range
\.          a literal dot — bare . means ANY character
(?: )       group without capturing;  ( ) captures and .match() hands the pieces back
|           alternation, LOWEST precedence, so it needs parentheses
```

Mine: `/^-?(\d+\.?\d*|\d*\.?\d+)$/` — optional sign, then digits with an optional trailing dot, **or**
an optional leading dot with digits. Accepts `"1"`, `"1.15"`, `"1."`, `".5"`, `"-0.5"`; rejects `""`,
`"-"`, `"."`, `"1.2.3"`, `"1e18"`, `" 1"`. One regex can validate *and* hand back the halves via
capture groups — I split separately this time, which also works.

## Sign handling, learned the hard way

The sign is a **separate concern** from the digits. Strip it once at the top, work on unsigned digits,
re-attach once at the end — and make sure **no early return skips the re-attachment** (bug 6). Measuring
`amountString.length` while the `"-"` was still attached is what sent negatives down the wrong branch
and produced `".-1"`.

## TypeScript earned its keep

`amountStr.split(ai + 2)` was a compile error: `split` takes a **separator**, not a position (`slice`
takes positions). In plain JS it coerces to `"1"` and splits on the *character* `1` — silently wrong,
an hour lost. That's problem 07's whole argument, met early.
