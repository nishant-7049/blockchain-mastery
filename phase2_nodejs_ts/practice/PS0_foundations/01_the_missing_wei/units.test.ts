import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseUnits, formatUnits } from "./units.ts";

test("parseUnits: exact for values floats get wrong", () => {
  assert.equal(parseUnits("1.15", 18), 1150000000000000000n);
  assert.equal(parseUnits("0.1", 18), 100000000000000000n);
  assert.equal(parseUnits("123456789.123456789123456789", 18), 123456789123456789123456789n);
  assert.equal(parseUnits("9007199254740993", 0), 9007199254740993n); // MAX_SAFE_INTEGER + 2
});

test("parseUnits: simple values and edge shapes", () => {
  assert.equal(parseUnits("1", 18), 10n ** 18n);
  assert.equal(parseUnits("0", 18), 0n);
  assert.equal(parseUnits("1.", 6), 1000000n);
  assert.equal(parseUnits(".5", 6), 500000n);
  assert.equal(parseUnits("0.000001", 6), 1n);
  assert.equal(parseUnits("007.50", 2), 750n);
});

test("parseUnits: negatives", () => {
  assert.equal(parseUnits("-0.5", 6), -500000n);
  assert.equal(parseUnits("-1.000000000000000001", 18), -1000000000000000001n);
});

test("parseUnits: rejects garbage", () => {
  for (const bad of ["", "-", ".", "-.", "1.2.3", "1e18", "abc", " 1", "1 ", "+-1", "0x10", "1,5"]) {
    assert.throws(() => parseUnits(bad, 18), `should throw for ${JSON.stringify(bad)}`);
  }
});

test("parseUnits: rejects precision it cannot represent", () => {
  assert.throws(() => parseUnits("0.0000001", 6));
  assert.throws(() => parseUnits("1.5", 0));
});

test("formatUnits: exact and trimmed", () => {
  assert.equal(formatUnits(1150000000000000000n, 18), "1.15");
  assert.equal(formatUnits(1000000n, 6), "1");
  assert.equal(formatUnits(0n, 18), "0");
  assert.equal(formatUnits(1n, 18), "0.000000000000000001");
  assert.equal(formatUnits(-1n, 18), "-0.000000000000000001");
  assert.equal(formatUnits(-1500000n, 6), "-1.5");
  assert.equal(formatUnits(123456789123456789123456789n, 18), "123456789.123456789123456789");
  assert.equal(formatUnits(42n, 0), "42");
});

test("round trip", () => {
  for (const s of ["1.15", "0.000000000000000001", "-3.14159", "100", "999999999999.999999999999999999"]) {
    assert.equal(formatUnits(parseUnits(s, 18), 18), s);
  }
});

test("no floating point allowed in the implementation", () => {
  const src = readFileSync(new URL("./units.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  // word-boundary matching, so a helper named e.g. isValidNumber() is not a false positive
  const banned: [RegExp, string][] = [
    [/\bparseFloat\s*\(/, "parseFloat()"],
    [/\bparseInt\s*\(/, "parseInt()"],
    [/(^|[^A-Za-z0-9_$])Number\s*\(/, "Number()"],
    [/(^|[^A-Za-z0-9_$])Math\s*\./, "Math."],
  ];
  for (const [re, label] of banned) {
    assert.ok(!re.test(src), `units.ts still uses ${label}`);
  }
});
