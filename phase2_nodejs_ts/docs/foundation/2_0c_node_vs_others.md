# 2.0c — Node vs Others

---

## The Honest Answer

Every language/runtime has a sweet spot. Picking the wrong tool costs you performance, developer time, and complexity.

---

## Where Node.js Wins

**I/O-bound, high-concurrency workloads.**

Node's event loop shines when your server spends most of its time *waiting* — for databases, external APIs, blockchain RPCs, WebSocket messages.

```
Real-world Node sweet spots:
├── REST / GraphQL APIs (request → DB query → response)
├── WebSocket servers (thousands of persistent connections)
├── Blockchain RPC proxies (forward calls to nodes, wait for response)
├── Event listeners / indexers (watch chain events, write to DB)
├── Streaming data pipelines (read → transform → write)
└── CLI tools and scripts
```

The event loop handles all of this with **one thread** and near-zero overhead per connection. A Node server can hold 50,000 WebSocket connections comfortably where a thread-per-connection server would OOM.

---

## Where Node Loses

**CPU-bound work.** If your code actually *computes* — not waits — the single thread becomes a bottleneck.

```javascript
// This blocks EVERYTHING for however long it takes
app.post('/process', (req, res) => {
    const result = encryptMillionRecords(req.body.data); // pure CPU
    res.send(result);
});
// Every other request queues behind this one
```

Examples of CPU-heavy work Node handles badly:
- Video/image processing
- Complex cryptographic operations on large datasets
- Parsing and aggregating millions of on-chain transactions in memory
- Machine learning inference

---

## Node vs Go

Go is the most common alternative you'll see in blockchain infrastructure.

| | Node.js | Go |
|---|---|---|
| Concurrency model | Single thread + event loop | Goroutines (lightweight threads, M:N scheduling) |
| I/O | Non-blocking, async | Also non-blocking, but multi-threaded |
| CPU work | Bad (blocks loop) | Great (goroutines run in parallel across cores) |
| Memory | Higher (V8 overhead) | Very low |
| Startup time | Slow (JIT warmup) | Instant (compiled) |
| Throughput (I/O) | Excellent | Excellent |
| Throughput (CPU) | Poor | Excellent |
| Ecosystem for blockchain | Massive (ethers.js, viem, anchor, etc.) | Growing (go-ethereum is Go) |
| Dev speed | Fast | Medium |

**Go wins when:** high throughput + CPU work + low memory + compiled binary (validators, relayers, block explorers, custom RPC nodes).

**Node wins when:** fast iteration, rich SDK ecosystem, I/O-heavy work (most dApp backends, indexers, APIs).

---

## Node vs Rust

Rust is for when performance is non-negotiable and you can afford the development cost.

| | Node.js | Rust |
|---|---|---|
| Speed | Fast (JIT) | Fastest (native, no GC) |
| Memory safety | Runtime errors possible | Compile-time guaranteed |
| Memory usage | High | Minimal |
| Concurrency | Event loop | Fearless concurrency (ownership model) |
| Dev speed | Fast | Slow (steep learning curve) |
| Use in blockchain | SDKs, tools, dApp backends | Solana programs, Substrate, core infra |

**Rust wins when:** you're writing the protocol itself — Solana programs, consensus layers, ZK provers, anything where a bug costs millions.

**Node wins when:** you're building on top of the protocol, not inside it.

---

## The Blockchain Stack Reality

How these languages actually divide in real blockchain companies:

```
Smart Contracts     → Solidity / Rust / Move
Core protocol       → Go (go-ethereum, cosmos-sdk) / Rust (Solana, Substrate)
Indexers / APIs     → Node.js / Go
Frontend / dApps    → TypeScript (React/Next.js + viem/ethers.js)
Scripts / tooling   → Node.js / Python
```

You're learning all three (Node → Rust → Go) in this roadmap because each layer of the stack needs a different tool.

---

## One Rule of Thumb

> If it waits → Node  
> If it computes → Go or Rust  
> If it's a protocol or on-chain program → Rust
