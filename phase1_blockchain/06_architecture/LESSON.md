# Milestone 1.6: Architecture — EVM, Solana Sealevel, Cosmos ABCI, Modular vs Monolithic

---

## Why This Comes Next

You now know:
- cryptography secures ownership (1.1)
- blocks and chains store history (1.2)
- consensus decides the next block (1.3)
- networking spreads data (1.4)
- accounts and transactions move value (1.5)

One big question remains before Phase 1 is complete:

**How are different blockchains actually built? What makes Ethereum different from Solana different from Cosmos under the hood?**

This milestone is about the architecture — the design decisions that shape
everything else: performance, flexibility, developer experience, and trade-offs.

---

## 1. The Core Problem Every Blockchain Solves

Every blockchain needs to answer:

```
1. Who executes transactions?      → Execution layer
2. What rules govern execution?    → Runtime / VM
3. How is agreement reached?       → Consensus layer
4. How does data spread?           → Network layer
5. Where is data stored?           → Data availability layer
```

Different chains answer these questions differently.
That's where architectural differences come from.

---

## 2. EVM — Ethereum Virtual Machine

### What is the EVM?

The EVM is the **execution engine** of Ethereum.
It's a sandboxed virtual computer that runs smart contract code.

```
Think of it like a computer inside a computer:

  Real computer: your laptop, runs your OS
  EVM:           a virtual computer, runs smart contracts

  The EVM is:
    - Deterministic (same input → same output on every node)
    - Sandboxed (contracts can't access your filesystem or internet)
    - Stack-based (uses a stack for computation, not registers)
    - Turing-complete (can run any computable program)
    - Gas-metered (every operation costs gas, prevents infinite loops)
```

### How Smart Contracts Work

```
Developer writes Solidity code:

  contract Token {
    mapping(address => uint256) balances;

    function transfer(address to, uint256 amount) public {
      require(balances[msg.sender] >= amount);
      balances[msg.sender] -= amount;
      balances[to] += amount;
    }
  }

Solidity compiler compiles it to EVM BYTECODE:
  (a sequence of low-level opcodes)
  60806040526004361061004...  (unreadable hex)

Bytecode is deployed to Ethereum → gets an address (e.g. 0xUSDC...)
Anyone can call it by sending a tx to that address.
```

### EVM Opcodes

```
The EVM has ~150 opcodes. Examples:

  ADD      → pop two values, push sum         (3 gas)
  MSTORE   → store value in memory            (3 gas)
  SLOAD    → load from contract storage       (2,100 gas)
  SSTORE   → write to contract storage        (20,000 gas)
  CALL     → call another contract            (varies)
  REVERT   → abort execution, undo changes    (0 gas, returns remaining)

Storage operations (SLOAD, SSTORE) are expensive
because they read/write to the global state — every node must do it.
Computation (ADD, MUL) is cheap.
```

### The EVM Execution Flow

```
Alice calls transfer() on USDC contract:

  tx: { to: 0xUSDC, data: "transfer(Bob, 100)", value: 0 }

EVM loads the contract bytecode at 0xUSDC.

EVM executes opcode by opcode:
  PUSH 100          ← amount
  PUSH 0xBob        ← recipient
  CALL transfer()   ← execute the function

  Inside transfer():
    SLOAD balances[Alice]     ← read Alice's balance
    Compare with 100          ← check if sufficient
    SSTORE balances[Alice]-=  ← update Alice's balance
    SSTORE balances[Bob]+=    ← update Bob's balance

Each opcode costs gas. Total: ~65,000 gas for ERC-20 transfer.
State changes committed to the global state trie.
```

### Why EVM is Everywhere

```
Ethereum launched the EVM in 2015.
It became the industry standard.

Chains that run the EXACT same EVM:
  Ethereum mainnet
  Polygon
  Avalanche C-Chain
  BNB Smart Chain
  Arbitrum (with some differences)
  Optimism (with some differences)
  Base
  ...dozens more

This is called "EVM compatibility."

Benefits:
  ✓ Deploy the same contract on all EVM chains
  ✓ Same developer tools (Hardhat, Foundry, Remix)
  ✓ Same languages (Solidity, Vyper)
  ✓ Massive existing ecosystem of audited contracts

This is why Ethereum has the largest developer ecosystem.
```

### EVM Limitations

```
✗ Single-threaded: one transaction at a time, in order
  → throughput ceiling (~15-30 TPS on mainnet)

✗ Global state bottleneck: every contract shares one state trie
  → parallel execution is extremely hard

✗ Storage is expensive: SSTORE costs 20,000 gas
  → storing data on-chain is costly

✗ 256-bit word size: all values are 32 bytes
  → not optimal for all computations
```

---

## 3. Non-EVM Chains

Not every chain uses the EVM. Some were designed from scratch
with different goals: speed, parallelism, or specific use cases.

---

## 4. Solana — Sealevel Runtime

### What is Sealevel?

Sealevel is Solana's parallel transaction processing engine.
It's the Solana equivalent of the EVM — but designed for parallelism.

```
EVM:      processes transactions ONE AT A TIME (sequential)
Sealevel: processes MANY transactions SIMULTANEOUSLY (parallel)

This is Solana's biggest architectural innovation.
```

### Why Parallel Execution is Hard

```
Imagine two transactions:
  tx A: Alice sends 1 SOL to Bob
  tx B: Charlie sends 1 SOL to Dave

These are INDEPENDENT. They touch different accounts.
There's no reason to run them sequentially.
They can run at the same time safely.

But:
  tx C: Alice sends 1 SOL to Bob
  tx D: Alice sends 1 SOL to Charlie

These CONFLICT. Both touch Alice's account.
Must run sequentially — can't update the same account simultaneously.
```

### How Sealevel Enables Parallelism

Solana requires every transaction to **declare upfront** which accounts it will read or write.

```
tx A declares: reads [Alice], writes [Alice, Bob]
tx B declares: reads [Charlie], writes [Charlie, Dave]

Sealevel checks: do A and B touch the same accounts?
  Alice ≠ Charlie, Alice ≠ Dave
  Bob ≠ Charlie, Bob ≠ Dave
  NO OVERLAP → run A and B in PARALLEL on different CPU cores

tx C declares: reads [Alice], writes [Alice, Bob]
tx D declares: reads [Alice], writes [Alice, Charlie]
  Alice OVERLAPS → run C and D SEQUENTIALLY
```

```
Result:

  Transactions that don't conflict → parallel execution
  Transactions that do conflict    → sequential execution

  In practice, most transactions in a block are independent.
  Solana can utilize all CPU cores simultaneously.
  → Much higher theoretical throughput than EVM.
```

### Solana's Account Model

Solana's architecture is fundamentally different from Ethereum.

```
In Ethereum:
  Smart contract = code + storage bundled together
  The contract owns its own data.

In Solana:
  CODE and DATA are SEPARATED.

  Programs (code):
    → stateless, read-only after deployment
    → just logic, no data stored inside

  Accounts (data):
    → store all state
    → owned by a program
    → any account can hold data for any program

Example:
  Ethereum USDC contract:
    bytecode + balances mapping all in one contract at 0xUSDC

  Solana USDC program:
    Program account: just bytecode at Program_ID
    Token accounts:  Alice's USDC balance in a separate account
                     Bob's USDC balance in another account

  Each user has their OWN token account.
  The program just contains the logic to update those accounts.
```

### Why This Separation Enables Parallelism

```
Ethereum:
  USDC contract has ONE storage trie.
  Alice's transfer and Bob's transfer both touch the same storage.
  → Cannot parallelize easily.

Solana:
  Alice's token account is a separate account from Bob's.
  Alice's transfer touches [Alice's account, Recipient's account].
  Bob's transfer touches [Bob's account, Their recipient's account].
  If they don't overlap → run in parallel.
  → Easy to parallelize.
```

### Programs vs Smart Contracts

```
Ethereum smart contract:
  - Has code AND state together
  - Stateful: stores its own data
  - Deployed once, gets an address

Solana program:
  - Has code ONLY (stateless)
  - State lives in separate accounts OWNED by the program
  - Deployed once, gets a Program ID

Think of it:
  Ethereum: each contract is a house (has rooms for data inside)
  Solana:   programs are rules posted on a wall,
            accounts are filing cabinets the rules apply to
```

### Solana's Performance Numbers

```
Theoretical:  65,000 TPS
Practical:    2,000-4,000 TPS under real conditions
Block time:   ~400ms slots
Finality:     ~12 seconds

vs Ethereum:
  Theoretical:  ~30 TPS
  Practical:    ~15 TPS
  Block time:   12 seconds
  Finality:     ~15 minutes
```

### Solana Trade-offs

```
✓ High throughput via parallel execution
✓ Low fees (fractions of a cent per tx)
✓ Fast block times (~400ms)

✗ High hardware requirements for validators
   (128GB+ RAM, fast NVMe, gigabit internet)
✗ Transactions must declare all accounts upfront
   (more complex programming model)
✗ Network has experienced outages under extreme load
✗ More centralized validator set due to hardware costs
```

---

## 5. Cosmos SDK — ABCI Architecture

### What is Cosmos SDK?

Cosmos SDK is a **framework for building custom blockchains**.
Not a single chain — a toolkit that lets you build your own.

```
Ethereum approach:
  One chain. Deploy a smart contract on it.
  Your "app" is a contract inside Ethereum.
  You share block space and state with every other app.

Cosmos approach:
  Build your OWN blockchain with your OWN rules.
  Your app IS the chain.
  You don't share block space with anyone.
  This is called an "app-chain."
```

### Why App-Chains?

```
Problems with shared smart contract platforms (Ethereum):

  1. Shared block space:
     CryptoKitties launched in 2017 → congested all of Ethereum
     Gas fees spiked → every other app suffered

  2. Shared state:
     Every contract is on the same global state
     → complex interactions, security risks

  3. Governance:
     You can't change Ethereum's rules for your app
     You're constrained by Ethereum's parameters

Cosmos solution:
  Each app gets its OWN chain.
  Own block space. Own validator set. Own governance. Own rules.
  Connected to others via IBC (Inter-Blockchain Communication).
```

### What ABCI Means

ABCI = Application BlockChain Interface

```
This is the key architectural idea of Cosmos:

  ┌─────────────────────────────────────┐
  │           APPLICATION               │
  │   (your custom business logic)      │
  │   Bank module, Staking module,      │
  │   DEX logic, NFT logic, etc.        │
  ├─────────────────────────────────────┤
  │              ABCI                   │
  │   (standard interface / API)        │
  │   InitChain, BeginBlock,            │
  │   DeliverTx, EndBlock, Commit       │
  ├─────────────────────────────────────┤
  │         CometBFT (consensus)        │
  │   P2P networking + mempool +        │
  │   BFT consensus rounds              │
  └─────────────────────────────────────┘

ABCI is the contract between the app and the consensus engine.
CometBFT handles networking and consensus.
Your application handles state transitions.
They communicate through ABCI.
```

### ABCI Messages

```
CometBFT → App (ABCI calls):

  InitChain:    "Chain is starting. Here's the genesis state."
                App: set up initial balances, validators, params

  BeginBlock:   "New block is starting. Here's the block header."
                App: can run pre-block logic (e.g. distribute rewards)

  DeliverTx:    "Here's a transaction. Execute it."
                App: validate + apply state changes
                Returns: success/failure + events + gas used

  EndBlock:     "Block is ending."
                App: can run post-block logic (e.g. validator updates)

  Commit:       "Block is committed. Persist the state."
                App: flush state to disk, return state root hash

This separation means:
  You can swap out CometBFT for a different consensus engine
  as long as it speaks ABCI. The app doesn't care.
```

### Cosmos SDK Modules

```
Cosmos SDK gives you pre-built modules:

  x/bank:       send tokens between accounts
  x/staking:    stake tokens, become validator, earn rewards
  x/gov:        on-chain governance (proposals, voting)
  x/slashing:   slash misbehaving validators
  x/ibc:        inter-blockchain communication
  x/wasm:       run CosmWasm smart contracts

You pick the modules you need.
You can write your own modules for custom logic.
Your chain = whatever combination you build.

Examples of Cosmos SDK chains:
  Cosmos Hub (ATOM)
  Osmosis (DEX chain)
  dYdX (derivatives trading chain)
  Celestia (data availability chain)
  Injective (financial chain)
```

### IBC — How Cosmos Chains Talk to Each Other

```
Each app-chain is its own island.
IBC (Inter-Blockchain Communication) connects them.

Think of IBC like TCP/IP for blockchains:
  TCP/IP: standard protocol that lets any computer talk to any other
  IBC:    standard protocol that lets any Cosmos chain talk to any other

Alice has ATOM on Cosmos Hub.
She wants to trade on Osmosis (a DEX chain).

  1. Alice sends ATOM via IBC to Osmosis
  2. Cosmos Hub locks her ATOM
  3. Osmosis mints "IBC/ATOM" (voucher) for Alice
  4. Alice trades on Osmosis
  5. To get back: Osmosis burns IBC/ATOM, Hub releases real ATOM

No centralized bridge needed. No trusted intermediary.
Pure cryptographic verification between chains.
```

### Cosmos Trade-offs

```
✓ App-chain sovereignty (own rules, own governance)
✓ No shared block space competition
✓ Modular: pick the modules you need
✓ IBC: trustless cross-chain communication
✓ Fast finality via CometBFT

✗ Each app-chain needs its own validator set
  → bootstrapping security is hard for new chains
✗ More operational complexity than deploying a smart contract
✗ Fragmented liquidity across many chains
✗ IBC adds latency for cross-chain operations
```

---

## 6. Modular vs Monolithic Blockchains

This is one of the biggest architectural debates in blockchain today.

### What is a Monolithic Blockchain?

A monolithic blockchain handles EVERYTHING in one layer:

```
┌──────────────────────────────────────────┐
│           MONOLITHIC CHAIN               │
│                                          │
│  Execution      (runs transactions)      │
│  Consensus      (agrees on order)        │
│  Data Availability (stores all data)     │
│  Settlement     (finality)               │
│                                          │
│  All in one. One chain does everything.  │
└──────────────────────────────────────────┘

Examples: Bitcoin, early Ethereum, Solana, BSC
```

```
Pros:
  ✓ Simple design
  ✓ Easy to reason about security
  ✓ No inter-layer communication needed

Cons:
  ✗ The "scalability trilemma":
    You can only pick 2 of 3:
      - Decentralized
      - Secure
      - Scalable

  To scale → increase block size or speed
           → requires better hardware
           → fewer nodes can participate
           → less decentralized
```

### The Scalability Trilemma

```
              Decentralized
                  △
                 /  \
                /    \
               /      \
              /________\
           Secure     Scalable

Bitcoin:   Decentralized + Secure   (not very scalable)
Solana:    Secure + Scalable        (less decentralized, high hw requirements)
BSC:       Scalable + ...           (21 validators, much less decentralized)

No monolithic chain has solved all three simultaneously.
That's why modular architecture was proposed.
```

### What is a Modular Blockchain?

A modular blockchain **separates these concerns into specialized layers**:

```
┌──────────────────────────────────────────┐
│         EXECUTION LAYER                  │
│  Rollups (Arbitrum, Optimism, zkSync)    │
│  Run transactions, compute state         │
├──────────────────────────────────────────┤
│         SETTLEMENT LAYER                 │
│  Ethereum L1                             │
│  Verify proofs, resolve disputes         │
├──────────────────────────────────────────┤
│      DATA AVAILABILITY LAYER             │
│  Ethereum blobs / Celestia / EigenDA     │
│  Ensure transaction data is available    │
├──────────────────────────────────────────┤
│         CONSENSUS LAYER                  │
│  Ethereum beacon chain / Celestia        │
│  Order blocks, agree on canonical chain  │
└──────────────────────────────────────────┘

Each layer specializes. Each can be optimized independently.
```

### The Four Layers Explained

**Execution Layer:**
```
Where transactions actually run.
Rollups (Arbitrum, Optimism, Base, zkSync) live here.

  Users send txs to the rollup.
  Rollup executes them off the main chain.
  Rollup posts compressed results back to L1.

  Result: much higher throughput than L1.
  Arbitrum: ~40,000 TPS theoretical
  zkSync Era: ~20,000 TPS theoretical
```

**Data Availability Layer:**
```
The most critical and often misunderstood layer.

After a rollup executes txs, it must publish the DATA
so anyone can verify what happened and reconstruct state.

"Data availability" = the guarantee that transaction data
was published and is accessible.

Without it: a rollup operator could execute txs,
            post a result, but hide the data.
            Nobody can verify the result.
            Funds could be stolen.

Solutions:
  Ethereum blobs (EIP-4844): cheap temporary data storage on Ethereum
  Celestia: dedicated DA layer, very cheap
  EigenDA: restaked ETH securing a DA layer
```

**Settlement Layer:**
```
Where disputes are resolved and proofs are verified.

For rollups, this is usually Ethereum L1.

Optimistic rollups:
  Post result, wait 7 days for fraud proofs.
  If someone submits a fraud proof → result overturned.
  If nobody challenges → result accepted.

ZK rollups:
  Post result + cryptographic proof (zk-SNARK/STARK).
  Ethereum verifies the proof immediately.
  No waiting period needed.
  Mathematically proven correct.
```

**Consensus Layer:**
```
Orders blocks and agrees on the canonical chain.
Ethereum's beacon chain handles this for Ethereum ecosystem.
Celestia combines consensus + data availability in one layer.
```

### Ethereum's Modular Roadmap

```
Ethereum's strategy: be the settlement + DA layer,
let rollups handle execution.

Before 2022 (monolithic):
  All execution on Ethereum L1
  ~15 TPS, $50+ fees during congestion

The Merge (2022):
  Separated consensus (beacon chain) from execution

EIP-4844 / Proto-Danksharding (March 2024):
  Added "blobs" — cheap temporary storage for rollup data
  Rollup fees dropped 10-100x overnight
  Arbitrum: $0.50 tx → $0.02 tx after EIP-4844

Full Danksharding (future):
  Massive data availability expansion
  Ethereum becomes the backbone for thousands of rollups
  Each rollup specializes in something different
```

### Celestia — Pure Modular Architecture

```
Celestia doesn't execute transactions.
It ONLY does consensus + data availability.

  "We don't care what the transactions mean.
   We just make sure they're ordered and available."

Any chain can use Celestia as its DA layer:
  Post your block data to Celestia
  Celestia orders it and ensures availability
  Your chain handles execution and settlement

Result:
  Very cheap data posting
  Flexible: any execution environment can use it
  Early adopters: Eclipse (SVM on Celestia), Manta Pacific
```

### Monolithic vs Modular Summary

```
                  Monolithic          Modular
                  ──────────          ───────
Design:           All in one          Specialized layers
Examples:         Bitcoin, Solana     Ethereum L2s, Celestia
Throughput:       Limited by L1       Each layer scales independently
Complexity:       Simple              Complex (inter-layer communication)
Security:         One attack surface  Multiple layers to secure
Flexibility:      Rigid               Mix and match layers
Status:           Battle-tested       Newer, still maturing
```

---

## 7. Architecture Side by Side

```
                Ethereum        Solana          Cosmos SDK
                ─────────────   ─────────────   ──────────────
VM/Runtime:     EVM             Sealevel        CosmWasm / custom
Execution:      Sequential      Parallel        Sequential (per chain)
Smart contract: Solidity/Vyper  Rust (programs) Rust (CosmWasm) / Go modules
State model:    Account (trie)  Accounts (flat) Key-value (IAVL+)
Consensus:      Casper (PoS)    Tower BFT       CometBFT
Finality:       ~15 min         ~12 sec         Instant
TPS:            ~15-30          ~2000-4000      ~10,000 per chain
Scalability:    L2 rollups      Parallelism     App-chains + IBC
Philosophy:     One chain       One fast chain  Many specialized chains
```

---

## 8. Key Takeaways

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  EVM          → Ethereum's execution engine. Stack-based,    │
│                 Turing-complete, gas-metered. Industry        │
│                 standard — dozens of EVM-compatible chains.  │
│                                                               │
│  Sealevel     → Solana's parallel runtime. Txs declare       │
│                 accounts upfront → non-conflicting txs run    │
│                 simultaneously on multiple CPU cores.         │
│                                                               │
│  Cosmos ABCI  → Separation of consensus (CometBFT) and       │
│                 application (your chain logic). Build your    │
│                 own blockchain as an app-chain.               │
│                                                               │
│  Monolithic   → One chain does everything. Simple but        │
│                 hits scalability limits.                      │
│                                                               │
│  Modular      → Split execution, DA, settlement, consensus   │
│                 into specialized layers. Each scales          │
│                 independently.                                │
│                                                               │
│  The trend    → Monolithic chains optimize internally         │
│                 (Solana parallelism). Modular chains          │
│                 specialize (Ethereum rollup ecosystem).       │
│                 Both are valid approaches.                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer without scrolling up:

1. What is the EVM? What does "sandboxed" and "deterministic" mean in this context?
2. Why is SSTORE (writing to storage) so much more expensive than ADD (addition)?
3. What does "EVM compatible" mean and why does it matter for developers?
4. What is Sealevel? How does it achieve parallel execution?
5. What does a Solana transaction need to declare upfront and why?
6. What is the difference between a Solana Program and an Ethereum smart contract?
7. What does ABCI stand for and what problem does it solve in Cosmos?
8. What is an app-chain? Why would someone build one instead of deploying a smart contract?
9. What is the scalability trilemma? Give a real chain example for each corner.
10. What are the four layers of a modular blockchain? What does each do?
11. What is data availability and why does it matter for rollups?
12. What is the difference between an optimistic rollup and a ZK rollup?

---

## Next

→ **Milestone 1.7: DeFi Primitives** — AMMs, lending/borrowing, oracles, bridges,
  liquid staking, MEV
