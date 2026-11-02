import { createHash } from "node:crypto";

export type Tx = { from: string; to: string; value: bigint; nonce: number };

export function hashTx(tx: Tx): string {
  return createHash("sha256").update(`${tx.from}:${tx.to}:${tx.value}:${tx.nonce}`).digest("hex");
}

// "It's async, so it doesn't block." — a teammate, shortly before the outage.
export async function indexTransactions(txs: Tx[]): Promise<Map<string, Tx>> {
  const index = new Map<string, Tx>();
  for (const tx of txs) {
    index.set(hashTx(tx), tx);
  }
  return index;
}
