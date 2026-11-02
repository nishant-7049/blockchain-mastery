import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);

export type Strategy = { name: string; quote(amountIn: bigint): bigint };

// Written when every plugin was CJS.
export async function loadStrategies(dir: string): Promise<Strategy[]> {
  return readdirSync(dir).map((file) => require(join(dir, file)).strategy);
}

// "Hot reload", v1. Ops reports it keeps running the old code.
export async function reloadStrategies(dir: string): Promise<Strategy[]> {
  return loadStrategies(dir);
}
