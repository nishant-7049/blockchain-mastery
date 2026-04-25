# Milestone 1.2: Blockchain Core — Blocks, Chains, State Machines, Genesis, Forks

---

## What is a Blockchain, Really?

Strip away the hype. A blockchain is just a **linked list of blocks where the links are hashes**.

```
Regular linked list (programming):
  Block A  →  Block B  →  Block C
  (pointer)   (pointer)   (pointer)

Blockchain:
  Block A  ←  Block B  ←  Block C
  (hash)      (hash)      (hash)

Each block stores the HASH of the previous block.
That's the "chain" in blockchain.
```

The arrow direction matters — each block **points backward** to its parent. The latest block knows about all history. The first block knows nothing ahead.

---

## What's Inside a Block?

Every block has two parts: a **header** and a **body**.

```
┌─────────────────────────────────────┐
│          BLOCK HEADER               │
│                                     │
│  block_hash:    SHA-256(this)       │  ← identity of this block
│  prev_hash:     SHA-256(prev)       │  ← link to parent block
│  height:        1042                │  ← block number (position in chain)
│  timestamp:     1711036800          │  ← when block was created
│  merkle_root:   0xabc123...         │  ← summary of all txs (from 1.1!)
│  nonce:         2083236893          │  ← PoW solution (Bitcoin)
│  state_root:    0xdef456...         │  ← snapshot of all account balances
│                                     │
├─────────────────────────────────────┤
│          BLOCK BODY                 │
│                                     │
│  tx1: Alice → Bob, 0.5 BTC         │
│  tx2: Charlie → Dave, 1.2 ETH      │
│  tx3: Eve → Frank, 0.01 BTC        │
│  ... (hundreds/thousands)           │
│                                     │
└─────────────────────────────────────┘
```

Let me explain each field:

```
block_hash:   SHA-256 of the entire header. This IS the block's identity.
              When someone says "block 0xabc..." they mean its hash.

prev_hash:    The hash of the previous block. This is the CHAIN link.
              Change the previous block → its hash changes → this link breaks
              → every block after it breaks too. That's immutability.

height:       Just a counter. Block 0, block 1, block 2...
              Height 0 = genesis block (the very first one).

timestamp:    When the block was created. Unix time (seconds since 1970).

merkle_root:  Remember from 1.1? Hash tree of all transactions.
              Summarizes the entire body in 32 bytes.
              Lets light clients verify tx inclusion without downloading everything.

nonce:        In Proof of Work (Bitcoin), this is the number the miner
              kept changing until SHA-256(header) < target difficulty.
              This is what "mining" is — finding this number.

state_root:   Root hash of the entire world state AFTER executing all txs.
              Every account balance, every contract's storage — all summarized
              in one hash. Change one balance → state root changes.
              (Bitcoin doesn't have this — Ethereum introduced it.)
```

**The header is tiny** (~80 bytes in Bitcoin). **The body is big** (all the transactions). This separation matters — light clients only need headers.

### Bitcoin Block Header (Real Structure)

```
┌────────────────────────────────────────┐
│ version:       4 bytes                 │  ← protocol version
│ prev_hash:     32 bytes                │  ← hash of previous block
│ merkle_root:   32 bytes                │  ← root of tx merkle tree
│ timestamp:     4 bytes                 │  ← when miner started working
│ bits:          4 bytes                 │  ← difficulty target (compressed)
│ nonce:         4 bytes                 │  ← the number miner was hunting for
│                                        │
│ Total:         80 bytes                │  ← tiny! That's the whole header
└────────────────────────────────────────┘

Satoshi's design: keep headers small so light nodes can
download ALL headers (millions) and still use little storage.
```

### Ethereum Block Header (More Fields)

```
Ethereum added more to the header:

  Everything Bitcoin has, PLUS:

  state_root:      root hash of ALL account balances and contract storage
  receipts_root:   root hash of transaction receipts (did tx succeed/fail?)
  gas_used:        how much computation this block consumed
  gas_limit:       max computation allowed in this block
  base_fee:        minimum gas price (EIP-1559)

  Why more fields? Bitcoin just tracks coin ownership.
  Ethereum tracks a whole computer's state (balances + programs + storage).
```

---

## How Blocks Link — The Chain

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Block 0    │     │   Block 1    │     │   Block 2    │
│  (Genesis)   │     │              │     │              │
│              │◄────│prev: hash(0) │◄────│prev: hash(1) │
│ hash: 0xaaa  │     │ hash: 0xbbb  │     │ hash: 0xccc  │
│ prev: 0x000  │     │ txs: [...]   │     │ txs: [...]   │
│ state: S0    │     │ state: S1    │     │ state: S2    │
└──────────────┘     └──────────────┘     └──────────────┘

Block 2 contains hash(Block 1's header)
Block 1 contains hash(Block 0's header)
Block 0 has no previous → prev_hash = 0x000...000
```

### Why is This Tamper-Proof?

```
Attacker wants to change a transaction in Block 1.

Step 1: Change tx in Block 1
Step 2: Block 1's merkle_root changes (tx changed → different hash tree)
Step 3: Block 1's block_hash changes (header changed → different SHA-256)
Step 4: Block 2's prev_hash no longer matches Block 1's new hash
Step 5: Block 2 is now INVALID
Step 6: Block 3's prev_hash no longer matches... and so on

To fake ONE old block, you must recompute EVERY block after it.
In Bitcoin, that means re-mining every block (redoing all the PoW).
With thousands of nodes checking, this is impossible.

Change 1 block → break entire chain after it
That's why it's called a CHAIN. The links ARE the security.
```

---

## State Machine — The Brain of the Blockchain

A blockchain is not just a chain of blocks. It's a **state machine**.

### What is a State Machine?

Something that:
1. Has a **current state** (the world right now)
2. Receives **inputs** (transactions)
3. Applies **rules** (transition function)
4. Produces a **new state**

```
State = the complete picture of "who owns what" right now

    ┌─────────────┐                        ┌─────────────┐
    │  State S0   │     Transaction        │  State S1   │
    │             │                        │             │
    │ Alice: 10   │ ── "Alice sends 1" ───│ Alice: 9    │
    │ Bob:   5    │     to Bob             │ Bob:   6    │
    │             │                        │             │
    └─────────────┘                        └─────────────┘

         Old State    +    Input     =     New State
```

### The Transition Function

This is the RULES ENGINE. It decides what's valid and what's not.

```
transition(state, transaction) → new_state OR error

Example rules:
  ✓ sender has enough balance?         (Alice has 10 BTC, sending 1 → OK)
  ✓ signature is valid?                (ECDSA verify from 1.1 → OK)
  ✓ nonce/sequence is correct?         (prevents replay attacks)
  ✓ fee is sufficient?                 (can pay the miner/validator)

  If ALL pass → apply the change → new state
  If ANY fail → reject transaction → state unchanged
```

### How Blocks Fit In

Each block is a **batch of state transitions**:

```
State S0 (genesis)
    │
    │  Block 1: [tx1, tx2, tx3]
    │    tx1: Alice → Bob, 1 BTC       ✓ applied
    │    tx2: Charlie → Dave, 0.5 BTC  ✓ applied
    │    tx3: Eve → Frank, 9999 BTC   ✗ rejected (insufficient balance)
    │
    ▼
State S1
    │
    │  Block 2: [tx4, tx5]
    │    tx4: Bob → Charlie, 0.3 BTC   ✓ applied
    │    tx5: Dave → Alice, 0.25 BTC   ✓ applied
    │
    ▼
State S2
    │
    ...continues forever
```

```
Key insight:

  The BLOCKCHAIN = the history  (what happened)
  The STATE      = the result   (what exists now)

  You could replay every block from genesis to rebuild the current state.
  That's exactly what a new node does when it "syncs."
```

### How Different Chains Represent State

```
Bitcoin — UTXO Model:
  State = set of unspent transaction outputs (UTXOs)
  Think of it like physical cash:
    Alice has a 10 BTC "coin" and a 5 BTC "coin"
    To send 3 BTC, she spends the 5 BTC coin,
    sends 3 to Bob, gets 2 back as "change"

  No accounts. No balances. Just coins being spent and created.

Ethereum — Account Model:
  State = account balances + smart contract storage
  Like a bank:
    Alice's account: balance = 10 ETH
    Bob's account: balance = 5 ETH
    Contract 0xabc: storage = {totalSupply: 1000000, ...}

  Has accounts. Has balances. Simpler to reason about.
  Stored in a Patricia Merkle Trie (state_root in header).

Both are state machines. Different representations, same idea.
```

---

## Genesis — Block Zero

Every blockchain starts with a **genesis block**. It's special.

### Bitcoin's Genesis Block (January 3, 2009)

```
┌───────────────────────────────────────────────────────────┐
│                BITCOIN GENESIS BLOCK                      │
│                                                           │
│  height:     0                                            │
│  prev_hash:  0x000...000 (none — it's the first)          │
│  timestamp:  2009-01-03 18:15:05 UTC                      │
│  nonce:      2083236893                                   │
│  difficulty: 1 (easiest possible)                          │
│                                                           │
│  Coinbase tx (the only transaction):                      │
│    reward: 50 BTC to Satoshi's address                    │
│    message embedded in the coinbase data:                 │
│                                                           │
│    "The Times 03/Jan/2009 Chancellor on brink of         │
│     second bailout for banks"                             │
│                                                           │
│  This message proves the block wasn't pre-mined before    │
│  this newspaper date. It also hints at WHY Bitcoin        │
│  was created — a response to the 2008 financial crisis.   │
│                                                           │
└───────────────────────────────────────────────────────────┘

Fun fact: The 50 BTC in the genesis block can NEVER be spent.
Satoshi hardcoded it that way. Whether intentional or a bug,
nobody knows.
```

### Ethereum's Genesis Block (July 30, 2015)

```
┌───────────────────────────────────────────────────────────┐
│              ETHEREUM GENESIS BLOCK                       │
│                                                           │
│  height:     0                                            │
│  prev_hash:  0x000...000                                  │
│  timestamp:  2015-07-30 15:26:13 UTC                      │
│  gas_limit:  5000                                         │
│  difficulty: 17179869184                                   │
│                                                           │
│  Initial state (from genesis.json):                       │
│    8893 accounts pre-funded with ETH                      │
│    These were ICO participants who bought ETH             │
│    before launch at ~$0.30 per ETH                        │
│                                                           │
│  Unlike Bitcoin:                                          │
│    - No coinbase message                                  │
│    - Pre-funded accounts (ICO distribution)               │
│    - Initial state was defined in a genesis.json file     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### What Genesis Defines

```
The genesis block answers:

  1. Who gets the initial tokens?
     Bitcoin:   only the mining reward (50 BTC)
     Ethereum:  8893 ICO participants pre-funded

  2. What are the initial parameters?
     Difficulty, gas limits, protocol version, chain ID

  3. What is the chain's identity?
     Chain ID distinguishes mainnet from testnet
     Ethereum mainnet = 1, Goerli testnet = 5, Sepolia = 11155111

  4. When did the chain start?
     The timestamp is the birth certificate

Every node MUST have the same genesis block.
Different genesis = different chain. Period.
```

### Why Genesis Matters

```
If you and I start with different genesis blocks:
  - We compute different State S0
  - Block 1 produces different State S1
  - We'll NEVER agree on any block
  - We're on different chains

Genesis is the SOCIAL CONTRACT — everyone agrees "this is how we start."
The math takes it from there.
```

---

## Forks — When the Chain Splits

### What is a Fork?

A fork is when the chain **splits into two paths**. Two valid blocks at the same height.

```
                         ┌──────────┐
                    ┌───►│ Block 5A │  ← Miner A found this
                    │    │ txs: ... │
┌──────────┐       │    └──────────┘
│ Block 4  │───────┤
│          │       │    ┌──────────┐
└──────────┘       └───►│ Block 5B │  ← Miner B found this
                        │ txs: ... │
                        └──────────┘

Two valid blocks at height 5. Which one is "real"?
```

### Why Do Forks Happen?

```
1. Natural / accidental (happens regularly):
   Two miners solve PoW at nearly the same time.
   Different nodes see different blocks first.
   Temporary — resolves within a few blocks.

2. Intentional / disagreement (rare, dramatic):
   Developers want to change how the chain works.
   Not everyone agrees on the change.
   Could become permanent — two separate chains forever.
```

### Soft Fork vs Hard Fork

**Soft Fork — tightening the rules:**

```
  Old rules: blocks can be up to 2MB
  New rules: blocks can be up to 1MB

  Old nodes: see new blocks as VALID (1MB < 2MB, passes old rules)
  New nodes: see new blocks as VALID (1MB = 1MB, passes new rules)

  Old nodes see old big blocks as VALID
  New nodes see old big blocks as INVALID (if > 1MB)

  Result: BACKWARD COMPATIBLE. Old nodes still work (they just
  accept everything). New nodes enforce stricter rules.

  The chain does NOT split permanently.
  New rules win as long as majority of miners upgrade.

  Real example — Bitcoin SegWit (August 2017):
    Changed how signatures are stored in transactions.
    Old nodes saw the new format as valid (backward compatible).
    Reduced effective tx size → more txs per block.
```

**Hard Fork — changing or loosening the rules:**

```
  Old rules: Max block size is 1MB
  New rules: Max block size is 8MB

  Old nodes: see new 8MB blocks as INVALID (too big!)
  New nodes: see old 1MB blocks as VALID but won't limit to 1MB

  Result: NOT COMPATIBLE. The chain SPLITS.
  Old nodes follow one chain, new nodes follow another.

                    ┌──── New chain (8MB blocks) ──────►
  Block N ──────────┤
                    └──── Old chain (1MB blocks) ──────►

  If everyone upgrades → old chain dies → just an upgrade.
  If some refuse       → two live chains → permanent split.
```

### Real Hard Fork Examples

```
Ethereum vs Ethereum Classic (2016):
  ─────────────────────────────────
  What happened:  A smart contract called "The DAO" was hacked.
                  $60 million worth of ETH stolen.

  The debate:     Should we rewrite history to undo the hack?

  Side A:         "Yes, save the money, we can fix this."
                  → became Ethereum (ETH)

  Side B:         "No, code is law. The blockchain should never be altered."
                  → became Ethereum Classic (ETC)

  Both chains run from the same genesis block up to block 1,920,000.
  After that, they diverge forever.


Bitcoin vs Bitcoin Cash (2017):
  ────────────────────────────────
  What happened:  Bitcoin was getting slow. 7 transactions per second.
                  Transaction fees were rising to $50+.

  The debate:     How do we scale?

  Side A:         "Keep 1MB blocks, scale with layers (Lightning Network)."
                  → stayed as Bitcoin (BTC)

  Side B:         "Just make blocks bigger — 8MB, then 32MB."
                  → became Bitcoin Cash (BCH)

  Both chains share history up to block 478,558 (August 1, 2017).
  After that, they are separate chains with separate rules.

  If you had 1 BTC before the fork, you had 1 BTC AND 1 BCH after.
  Same private key works on both chains (same history, same UTXOs).
```

### How Accidental Forks Get Resolved

```
In Bitcoin (Proof of Work):

Block 99
   │
   ├── Block 100A (miner in USA found this first)
   │      │
   │      └── Block 101A (another miner builds on 100A)
   │             │
   │             └── Block 102A ← THIS CHAIN IS LONGER, IT WINS
   │
   └── Block 100B (miner in China found this first)
          │
          └── Block 101B (someone builds on 100B)
                         ← shorter chain, ORPHANED (abandoned)

Rule: LONGEST CHAIN WINS (most accumulated proof of work)

Nodes that were following 100B see that 100A's chain is longer.
They SWITCH to the longer chain. This is called a "reorg."
Block 100B and 101B become "orphan blocks" — valid but abandoned.
Transactions in them go back to the mempool to be re-included.

This is why Bitcoin merchants wait for 6 confirmations:
  1 confirmation  = in a block, but might get reorged
  3 confirmations = probably safe
  6 confirmations = practically impossible to reorg
                    (attacker needs > 50% of total hashpower)
```

---

## Block Lifecycle — From Transaction to Finality

```
1. USER CREATES & SIGNS TRANSACTION
   Alice signs "send 1 BTC to Bob" with her private key.
   (Using ECDSA from Milestone 1.1)

2. BROADCAST TO NETWORK
   Alice's node sends the signed tx to peers.
   Peers validate the signature and relay it further.
   The tx spreads across the network (gossip protocol).

3. MEMPOOL (Memory Pool)
   Transaction sits in a waiting area on each node.
   Not in a block yet. Just waiting to be picked up.

   ┌──────────────────────────────┐
   │          MEMPOOL             │
   │                              │
   │  tx: Alice→Bob 1 BTC ← NEW  │
   │  tx: Charlie→Dave 0.5 BTC   │
   │  tx: Eve→Frank 2 BTC        │
   │  ...hundreds of pending txs  │
   │                              │
   │  Sorted by fee: highest fee  │
   │  transactions get picked     │
   │  first by miners.            │
   └──────────────────────────────┘

4. BLOCK CREATION (by miner or validator)
   A miner picks the highest-fee transactions from their mempool.
   Constructs a block: header + selected transactions.

   In Bitcoin: starts grinding nonces for Proof of Work.
   In Ethereum PoS: selected proposer builds and signs the block.

5. BLOCK VALIDATION
   Other nodes receive the new block and verify EVERYTHING:
     - Is the prev_hash correct?
     - Is the PoW valid? (Bitcoin) / Is the proposer valid? (PoS)
     - Are ALL signatures in ALL transactions valid?
     - Do ALL state transitions follow the rules?
     - Is the merkle_root correct?
     - Is the timestamp reasonable?

   If ANY check fails → reject the block entirely.

6. STATE UPDATE
   All nodes execute the transactions and update their local state.

   State S(n) + Block(n+1) → State S(n+1)

7. FINALITY
   The point at which a block CANNOT be reverted.

   Bitcoin:     ~60 minutes (6 blocks × 10 min each)
                Probabilistic — never 100%, but exponentially harder to revert
   Ethereum:    ~15 minutes (2 epochs)
                After finalization, reverting requires burning billions of $

   ┌─────────────────────────────────────────────────┐
   │ Confirmations:                                  │
   │                                                 │
   │   1 block deep  → 50% chance of reorg (risky)  │
   │   2 blocks deep → 25% (still risky)            │
   │   3 blocks deep → 12.5%                        │
   │   6 blocks deep → < 0.1% (safe for most uses)  │
   │  12 blocks deep → negligible                   │
   │                                                 │
   │ Each new block on top makes the old block       │
   │ exponentially harder to revert.                 │
   └─────────────────────────────────────────────────┘
```

---

## Putting It All Together

```
Genesis Block (hardcoded starting point)
    │
    │ defines initial state S0
    ▼
┌─────────┐   txs    ┌─────────┐   txs    ┌─────────┐
│ Block 0 │────────►│ Block 1 │────────►│ Block 2 │──── ...
│ S0      │         │ S1      │         │ S2      │
└─────────┘         └─────────┘         └─────────┘

Each block:
  1. Points back to parent (prev_hash)
  2. Contains transactions (body)
  3. Summarizes txs (merkle_root in header)
  4. Records new state (state_root)
  5. Is identified by its hash (block_hash)

The chain is:
  - An ordered history (blockchain)
  - A state machine (apply txs → new state)
  - Tamper-proof (change one block → break all after it)
  - Agreed upon (consensus picks which blocks are valid)
```

---

## Key Takeaways

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Block        → Container of transactions + metadata.    │
│                 Header (small, ~80 bytes in Bitcoin)     │
│                 + Body (big, all the transactions).      │
│                                                          │
│  Chain        → Blocks linked by hashes.                 │
│                 Change one block → break all after it.   │
│                 That's immutability.                      │
│                                                          │
│  State Machine → Rules engine. Takes old state + tx,     │
│                  produces new state. The real brain.     │
│                  Bitcoin = UTXO. Ethereum = accounts.    │
│                                                          │
│  Genesis      → Block 0. The social contract.            │
│                 Defines initial state. Same genesis =    │
│                 same chain.                               │
│                                                          │
│  Forks        → Chain splits. Soft = tighter rules       │
│                 (backward compatible). Hard = different   │
│                 rules (chain splits permanently).        │
│                                                          │
│  Finality     → When a block becomes irreversible.       │
│                 Bitcoin = ~60 min (probabilistic).       │
│                 Ethereum = ~15 min (economic finality).  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer without scrolling up:

1. What are the two parts of a block? What goes in each?
2. What happens if an attacker changes a transaction in block 100 of a 200-block chain?
3. What is a state machine? What are its 3 components?
4. How does Bitcoin's UTXO model differ from Ethereum's account model?
5. What is in a genesis block and why is it important?
6. What's the difference between a soft fork and a hard fork? Give one real example of each.
7. Why does Bitcoin need ~6 confirmations before a transaction is considered safe?
8. What is the mempool and how do miners decide which transactions to include?
9. Can you rebuild the current state from just the genesis block + all blocks? How?

---

## Next

→ **Milestone 1.3: Consensus** — PoW, PoS, DPoS, BFT, Tendermint/CometBFT, Solana's PoH + Tower BFT
