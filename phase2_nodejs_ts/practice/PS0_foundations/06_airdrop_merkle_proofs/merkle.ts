import { createHash } from "node:crypto";

export type ProofStep = { sibling: Buffer; position: "left" | "right" };

// Teammate's helper. The contract rejects every proof built with it.
function hashPair(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256").update(left.toString("hex") + right.toString("hex")).digest();
}

export function fromHex(s: string): Buffer {
  throw new Error("TODO");
}

export function merkleRoot(leaves: Uint8Array[]): Buffer {
  throw new Error("TODO");
}

export function getProof(leaves: Uint8Array[], index: number): ProofStep[] {
  throw new Error("TODO");
}

export function verifyProof(data: Uint8Array, proof: ProofStep[], root: Uint8Array): boolean {
  throw new Error("TODO");
}
