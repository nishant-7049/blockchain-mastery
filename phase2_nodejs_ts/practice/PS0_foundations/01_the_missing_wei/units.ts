// ⚠️ This is the code that shipped. It passes a quick manual test with "1" and "0.5",
// which is exactly why nobody caught it. Rewrite both functions.

export function parseUnits(value: string, decimals: number): bigint {
  return BigInt(Math.round(parseFloat(value) * 10 ** decimals));
}

export function formatUnits(amount: bigint, decimals: number): string {
  return (Number(amount) / 10 ** decimals).toString();
}
