export interface NonceRpc {
  getTransactionCount(address: string): Promise<number>;
}

// Shipped version. Works perfectly when you send one tx at a time.
export class NonceManager {
  private rpc: NonceRpc;
  private nonces = new Map<string, number>();

  constructor(rpc: NonceRpc) {
    this.rpc = rpc;
  }

  async next(address: string): Promise<number> {
    if (!this.nonces.has(address)) {
      const onChain = await this.rpc.getTransactionCount(address);
      this.nonces.set(address, onChain);
    }
    const nonce = this.nonces.get(address)!;
    this.nonces.set(address, nonce + 1);
    return nonce;
  }

  reset(address: string): void {
    this.nonces.delete(address);
  }
}
