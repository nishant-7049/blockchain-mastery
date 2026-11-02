export type Block = { number: number; hash: string };

export interface BlockRpc {
  getBlock(n: number): Promise<Block>;
}

// TODO: implement properly. This is "attempt 2" from the incident report: it LOOKS limited.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit <= 0) throw new Error("limit must be positive"); // without this, limit=0 loops forever. Can you see why?
  const promises = items.map(fn);
  const results: R[] = [];
  for (let i = 0; i < promises.length; i += limit) {
    const chunk = promises.slice(i, i + limit);
    results.push(...(await Promise.all(chunk)));
  }
  return results;
}

export function fetchBlocks(rpc: BlockRpc, from: number, to: number, limit = 5): Promise<Block[]> {
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return mapWithConcurrency(numbers, limit, (n) => rpc.getBlock(n));
}
