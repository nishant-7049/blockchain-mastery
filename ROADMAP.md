# Blockchain Developer Roadmap — Milestone Based

> Target roles: Backend Infra | Smart Contract Dev | Full-Stack dApp
> Languages: TypeScript, Rust, Go
> Chains: Solana, Cosmos
> LLD (Low Level Design) applied to every project

---

## Phase 1: Blockchain Foundations

No code yet — pure concepts. Solid foundation before touching any chain.

| # | Milestone | Topics |
|---|-----------|--------|
| 1.1 | Cryptography | Hashing (SHA-256, Keccak), digital signatures (ECDSA, Ed25519), Merkle trees, Merkle proofs |
| 1.2 | Blockchain Core | Blocks, chains, state machines, genesis, forks (soft/hard) |
| 1.3 | Consensus | PoW, PoS, DPoS, BFT, Tendermint/CometBFT, Solana's PoH + Tower BFT |
| 1.4 | Networking | P2P networks, gossip protocol, node types (full, light, archive, validator) |
| 1.5 | Accounts & Txs | UTXO vs Account model, nonce/sequence, transaction lifecycle, gas & fees |
| 1.6 | Architecture | EVM vs non-EVM, Solana runtime (Sealevel), Cosmos SDK (ABCI), modular vs monolithic |
| 1.7 | DeFi Primitives | AMMs, lending/borrowing, oracles, bridges, liquid staking, MEV |
| 1.8 | Security | Common attack vectors, reentrancy, flash loans, oracle manipulation, smart contract auditing basics |

---

## Phase 1.5: Solidity — Smart Contract Development

> Bridge between foundations and Phase 2. Learn Solidity theory,
> practice with logic exercises, then build real contracts from scratch.

### 1.5A — Solidity Language

| # | Milestone | Topics |
|---|-----------|--------|
| S1 | Solidity Basics | Variables, types, functions, visibility, state vs memory vs calldata |
| S2 | Control Flow | If/else, loops, require/revert/assert, custom errors |
| S3 | Data Structures | Mappings, arrays, structs, enums, nested mappings |
| S4 | OOP in Solidity | Contracts, inheritance, interfaces, abstract contracts, libraries |
| S5 | Special Variables | msg.sender, msg.value, block.timestamp, tx.origin, address(this) |
| S6 | ETH Handling | Payable functions, receive/fallback, transfer vs call vs send |
| S7 | Events & Logging | Emit events, indexed params, why events matter for dApps |
| S8 | Modifiers & Access | Custom modifiers, onlyOwner, role-based access, OpenZeppelin |
| S9 | Advanced Types | Function types, assembly basics, gas optimization patterns |
| S10 | Security Patterns | CEI pattern, reentrancy guards, safe math, checks in practice |

### 1.5B — Practice Sets (After Each Theory Milestone)

Each milestone has a set of logic exercises to solve before moving on.
Exercises go from simple → complex within each set.

| # | Practice Set | Focus |
|---|--------------|-------|
| P-S1 | Variables & Types | Declare, assign, convert between types |
| P-S2 | Control Flow | Write validation logic, revert conditions |
| P-S3 | Data Structures | Build a student registry, voting tally |
| P-S4 | OOP | Inherit contracts, implement interfaces |
| P-S5 | Special Variables | Write access controlled functions |
| P-S6 | ETH Handling | Accept, track, and withdraw ETH safely |
| P-S7 | Events | Emit and structure events for all state changes |
| P-S8 | Modifiers | Build reusable access control modifiers |
| P-S9 | Optimization | Rewrite gas-heavy code to be cheaper |
| P-S10 | Security | Identify and fix vulnerable code snippets |

### 1.5C — Contracts to Build (Small → Big)

Each contract applies LLD first (design → then code).

| # | Contract | Concepts Applied | Size |
|---|----------|-----------------|------|
| C1 | Counter | Basic state, functions, events | Tiny |
| C2 | Ether Wallet | ETH handling, receive, withdraw, owner | Small |
| C3 | Multi-Sig Wallet | Arrays, mappings, access control, confirmations | Small |
| C4 | ERC-20 Token | Interfaces, events, allowance, transfer logic | Small |
| C5 | ERC-721 NFT | Structs, mappings, mint/burn, ownership | Small |
| C6 | Voting Contract | Structs, mappings, time locks, access control | Medium |
| C7 | Staking Contract | ETH locking, reward calculation, time logic | Medium |
| C8 | Dutch Auction | Price decay over time, bidding, settlement | Medium |
| C9 | Simple DEX | Token swaps, liquidity, price formula (x*y=k) | Big |
| C10 | Lending Protocol | Collateral, borrow, interest, liquidation | Big |

---

## Phase 2: Node.js + TypeScript (Deep Revision + Projects)

### 2.0 — Foundation: Understanding Node.js & TypeScript

> Before writing code, understand what you're working with and why it exists.

| # | Milestone | Topics |
|---|-----------|--------|
| 2.0a | Why Node.js Exists | History: Ryan Dahl, the problem with Apache (thread-per-connection), why JavaScript on the server, the 2009 JSConf talk that started it all |
| 2.0b | Node.js Architecture | Single-threaded event loop, non-blocking I/O, V8 engine (what it does, how JIT compilation works), libuv (what it is, why C++ under JS), the call stack + callback queue + microtask queue |
| 2.0c | Node vs Others | When Node wins (I/O heavy, real-time, microservices) vs when it doesn't (CPU heavy), comparison with Go/Rust/Java for backend, why blockchain companies use Node |
| 2.0d | The Node Ecosystem | npm/yarn/pnpm (how package management works), CommonJS vs ESM (why two module systems), the node_modules problem, monorepos |
| 2.0e | Why TypeScript | What problems JS has that TS solves, type system philosophy (structural vs nominal), how tsc works (compilation pipeline), TS at runtime (it doesn't exist), tsconfig deep dive |
| 2.0f | TypeScript's Type System | Why it's "unsound by design", type narrowing, control flow analysis, declaration files (.d.ts), how TS interacts with node_modules |

### 2A — Language & Concepts Deep Dive

| # | Milestone | Topics |
|---|-----------|--------|
| 2.1 | TS Fundamentals | Advanced types, generics, conditional types, mapped types, template literals, type guards, discriminated unions |
| 2.2 | Async Mastery | Event loop internals, promises, async/await, streams, worker threads, clustering |
| 2.3 | Node Internals | V8 engine, libuv, buffer/streams, child processes, native addons (N-API) |
| 2.4 | Design Patterns | Singleton, factory, observer, strategy, decorator, repository, dependency injection |
| 2.5 | LLD Concepts | SOLID principles, class diagrams, sequence diagrams, API design, schema design, caching strategies |
| 2.6 | Testing | Unit (Jest/Vitest), integration, e2e, mocking strategies, test containers |
| 2.7 | DevOps Basics | Docker, docker-compose, CI/CD (GitHub Actions), env management |

### 2B — Database Deep Dive

| # | Milestone | DB | Depth | Topics |
|---|-----------|-----|-------|--------|
| 2.8 | PostgreSQL | SQL | Deep | Advanced queries, joins, indexing (B-tree, GIN, GiST), JSONB, transactions, migrations (Prisma/Drizzle), connection pooling, partitioning |
| 2.9 | MongoDB | NoSQL | Deep | Aggregation pipelines, indexing strategies, schema design patterns, transactions, change streams, sharding concepts |
| 2.10 | Redis | Cache/Queue | Deep | Data structures (strings, hashes, sets, sorted sets, streams), pub/sub, caching patterns (write-through, write-behind, cache-aside), rate limiting, distributed locks, Bull queues |
| 2.11 | ClickHouse | Analytics | Theory | Column-oriented storage, why it's fast for analytics, MergeTree engine, materialized views, basic queries on chain data |
| 2.12 | Cassandra | Wide-column | Theory | Partition keys, clustering keys, eventual consistency, when to use (high write throughput), comparison with ScyllaDB |
| 2.13 | Neo4j | Graph | Theory | Nodes, relationships, Cypher query language, use case: wallet relationship mapping, on-chain flow analysis |
| 2.14 | The Graph | Indexing | Theory | Subgraphs, schema definition, mappings, querying with GraphQL, how protocols use it |

### 2C — Projects (Small → Big, each applies LLD)

| # | Project | Stack | DB | LLD Focus | Size |
|---|---------|-------|-----|-----------|------|
| P2.1 | Crypto Price Tracker CLI | Node + TS + Axios | Redis (cache) | Single responsibility, caching strategy design | Small |
| P2.2 | Wallet Portfolio API | Express + TS | PostgreSQL + Redis | Repository pattern, schema design, class diagrams | Small |
| P2.3 | Blockchain Event Listener | Node + WebSocket + TS | MongoDB (change streams) | Observer pattern, event-driven architecture | Medium |
| P2.4 | On-Chain Analytics Service | Fastify + TS | PostgreSQL + ClickHouse (theory) | Data pipeline design, query optimization | Medium |
| P2.5 | Multi-Chain Token Dashboard | Next.js + tRPC + TS | PostgreSQL + Redis + MongoDB | Full system design, sequence diagrams, API contracts | Big |
| P2.6 | DEX Aggregator Backend | Fastify + TS + Bull queues | PostgreSQL + Redis | Queue architecture, rate limiting, LLD of routing algorithm | Big |

---

## Phase 3: Rust + Non-EVM Smart Contracts

### 3A — Rust Language

| # | Milestone | Topics |
|---|-----------|--------|
| 3.1 | Basics | Variables, mutability, types, functions, control flow |
| 3.2 | Ownership | Ownership, borrowing, references, lifetimes, the borrow checker |
| 3.3 | Structs & Enums | Struct methods, enum variants, pattern matching, Option, Result |
| 3.4 | Traits & Generics | Trait definitions, trait bounds, generic functions/structs, impl blocks |
| 3.5 | Error Handling | Result/Option chaining, custom errors, thiserror, anyhow |
| 3.6 | Collections & Iterators | Vec, HashMap, HashSet, iterator adaptors, closures |
| 3.7 | Memory & Smart Pointers | Box, Rc, Arc, RefCell, when to use each |
| 3.8 | Concurrency | Threads, channels, Mutex, async/await (Tokio basics) |
| 3.9 | Project Structure | Modules, crates, workspaces, Cargo features, testing |

### 3B — Solana Development

| # | Milestone | Topics |
|---|-----------|--------|
| 3.10 | Solana Architecture | Accounts model, programs, PDAs, rent, CPIs, Sealevel runtime |
| 3.11 | Anchor Framework | Project setup, #[program], #[account], constraints, error handling |
| 3.12 | Token Programs | SPL tokens, associated token accounts, minting, transferring |
| 3.13 | Testing | Bankrun, local validator, integration tests |

### 3C — Cosmos / CosmWasm Development

| # | Milestone | Topics |
|---|-----------|--------|
| 3.14 | Cosmos Architecture | Cosmos SDK, ABCI, Tendermint/CometBFT, modules, IBC |
| 3.15 | CosmWasm Basics | Contract structure (instantiate, execute, query), state management, cw-storage-plus |
| 3.16 | CosmWasm Advanced | Multi-contract interaction, submessages, reply, IBC contracts |
| 3.17 | Testing | cw-multi-test, integration testing |

### 3D — Rust Projects (Small → Big, with LLD)

| # | Project | Chain | LLD Focus | Size |
|---|---------|-------|-----------|------|
| P3.1 | CLI Blockchain Data Fetcher | — (pure Rust) | Module design, error hierarchy | Small |
| P3.2 | Token Vesting Program | Solana/Anchor | State machine design, account relationships | Small |
| P3.3 | Escrow Contract | CosmWasm | Contract interaction diagram, state transitions | Medium |
| P3.4 | Staking Vault Program | Solana/Anchor | Reward distribution LLD, PDA hierarchy | Medium |
| P3.5 | AMM / DEX Contract | CosmWasm | Liquidity pool math, swap routing LLD | Big |
| P3.6 | DAO Governance Program | Solana or Cosmos | Voting mechanism design, treasury management | Big |

---

## Phase 4: Go + Backend Infra

### 4A — Go Language

| # | Milestone | Topics |
|---|-----------|--------|
| 4.1 | Basics | Variables, types, functions, control flow, pointers |
| 4.2 | Structs & Interfaces | Methods, interface composition, embedding, type assertions |
| 4.3 | Concurrency | Goroutines, channels, select, sync package, context |
| 4.4 | Standard Library | net/http, encoding/json, io, os, testing |
| 4.5 | Modules & Tooling | Go modules, workspaces, linting, profiling (pprof) |
| 4.6 | Advanced Patterns | Middleware chains, graceful shutdown, connection pools, worker pools |

### 4B — Go Projects (Small → Big, with LLD)

| # | Project | Stack | LLD Focus | Size |
|---|---------|-------|-----------|------|
| P4.1 | REST API Boilerplate | Gin/Chi + PostgreSQL | Clean architecture, repository pattern | Small |
| P4.2 | Blockchain RPC Proxy | Go + Redis | Rate limiter design, circuit breaker pattern | Small |
| P4.3 | Block Explorer Backend | Go + PostgreSQL + Redis | Data ingestion pipeline, indexing strategy | Medium |
| P4.4 | P2P Message System | Go + libp2p | Peer discovery, message routing LLD | Medium |
| P4.5 | Custom Cosmos SDK Module | Cosmos SDK | Module architecture, keeper pattern, msg server | Big |
| P4.6 | Chain Monitoring & Alerting Service | Go + PostgreSQL + Redis + Grafana | Event processing pipeline, alert routing LLD | Big |

---

## LLD Integration Throughout

Every project includes these LLD artifacts before coding:

```
project/
├── docs/
│   ├── requirements.md        # What we're building and why
│   ├── class-diagram.md       # Entities, relationships, methods
│   ├── sequence-diagrams.md   # Key flows (happy path + error)
│   ├── api-design.md          # Endpoints, request/response schemas
│   ├── schema-design.md       # DB tables/collections + indexes
│   └── architecture.md        # Component diagram, data flow
├── src/
└── tests/
```

**Pattern:** Design first → Review → Code → Test → Refactor

---

## Progress Tracker

| Phase | Status |
|-------|--------|
| Phase 1: Blockchain Foundations | ✅ Complete |
| Phase 1.5: Solidity | ✅ Complete (C1–C10, 82 tests passing) |
| Phase 2: Node.js + TS + DBs | 🔄 In progress (2.0a) |
| Phase 3: Rust + Solana + Cosmos | ⬜ Not started |
| Phase 4: Go + Infra | ⬜ Not started |

---

## Estimated Timeline (flexible)

| Phase | Duration (approx) |
|-------|-------------------|
| Phase 1 | 1-2 weeks |
| Phase 2 | 4-6 weeks |
| Phase 3 | 6-8 weeks |
| Phase 4 | 4-6 weeks |

Total: ~4-5 months at consistent pace

---

> **How we work:** One milestone at a time. I teach the concept, you practice,
> we build the project together with LLD first, then code. No skipping ahead.
