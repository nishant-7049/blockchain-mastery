// Structural typing: these are just aliases. The compiler sees Wei, Gwei and bigint as the SAME type.
export type Wei = bigint;
export type Gwei = bigint;
export type Address = string;

export function wei(n: bigint): Wei {
  return n;
}

export function gwei(n: bigint): Gwei {
  return n;
}

export function gweiToWei(g: Gwei): Wei {
  return g * 1_000_000_000n;
}

export function addWei(a: Wei, b: Wei): Wei {
  return a + b;
}

export function toAddress(s: string): Address {
  return s;
}

export function sendTransaction(to: Address, value: Wei): string {
  return `send ${value} wei to ${to}`;
}
