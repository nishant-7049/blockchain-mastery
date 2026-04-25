# Milestone 1.4: Networking — P2P, Gossip Protocol, Node Types

---

## Why This Comes Next

You now know:
- cryptography secures ownership (1.1)
- blocks and chains store history (1.2)
- consensus decides who adds the next block (1.3)

But none of that answers:

**How do thousands of nodes spread across the world even talk to each other?**

How does Alice's transaction in Tokyo reach a miner in Iceland?
How does a new block produced in New York reach nodes in Seoul within seconds?
How does a brand new node joining the network get a copy of the entire history?

That is what networking solves.

---

## 1. The Old Model vs P2P

### How Traditional Apps Work (Client-Server)

```
You (client) → request → Server
                          Server has ALL the data
                          Server processes everything
You (client) ← response ← Server

Examples: Gmail, YouTube, Twitter

One central server (or cluster).
If it goes down → everyone is disconnected.
If it's evil → everyone is controlled.
```

### How Blockchain Works (Peer to Peer)

```
No central server. Every node talks directly to other nodes.

  Node A ←──────→ Node B
    ↑  ╲          ↗  ↑
    │    ╲       ╱   │
    │     ╲     ╱    │
    ↓      ╲   ╱     ↓
  Node D ←──Node C──→ Node E

Every node:
  - stores a copy of the blockchain
  - validates transactions and blocks
  - relays data to other nodes
  - communicates as both client AND server simultaneously
```

### Why P2P Matters for Blockchain

```
No single point of failure:
  Take down 1000 nodes → 9000 still running → chain survives

No single point of control:
  No company, government, or individual can shut it down
  by targeting one server

No trust required:
  Each node verifies everything independently
  You don't trust any single node — you trust the math
```

---

## 2. How Nodes Find Each Other — Peer Discovery

When a brand new node starts up, it knows nothing.
It has no peers. It doesn't know who else is on the network.

### Bootstrap Nodes (Hardcoded Seeds)

```
Every blockchain client comes with a hardcoded list of
well-known, stable nodes called BOOTSTRAP NODES or SEED NODES.

Bitcoin Core client has hardcoded DNS seeds:
  seed.bitcoin.sipa.be
  dnsseed.bluematt.me
  dnsseed.bitcoin.dashjr.org
  ...

New node starts up:
  Step 1: Connect to one of these seed nodes
  Step 2: Ask "who do you know?"
  Step 3: Seed node sends a list of other node addresses
  Step 4: Connect to those nodes
  Step 5: Ask them "who do you know?"
  Step 6: Repeat until you have enough peers (typically 8-125 connections)
```

### Peer Exchange

```
Once connected, nodes continuously share peer lists.

Node A ──→ Node B: "here are 10 nodes I know about"
Node B ──→ Node A: "here are 10 nodes I know about"

Over time, each node builds up a large address book of peers.
Next time it restarts, it connects to remembered peers first.
Doesn't need seed nodes again (unless all remembered peers are offline).
```

### How Many Peers?

```
Bitcoin:   8 outgoing connections (you connect to them)
           up to 125 incoming connections (they connect to you)

Ethereum:  ~50 peers typical

More peers:
  ✓ better connectivity
  ✓ faster propagation
  ✗ more bandwidth used
  ✗ more messages to process

There's a sweet spot per protocol.
```

---

## 3. Gossip Protocol — How Data Spreads

Once nodes are connected, how does a transaction or block
reach everyone in the world within seconds?

The answer is **gossip protocol** — named after how rumors spread.

### How Gossip Works

```
Alice submits a transaction. Her node broadcasts it to its peers.

Step 1: Alice's node → sends tx to 8 peers

Step 2: Each of those 8 nodes validates the tx,
        then forwards it to THEIR peers (minus who sent it)
        → 8 × 8 = 64 nodes now have it

Step 3: Those 64 nodes forward it
        → 64 × 8 = 512 nodes now have it (roughly)

Step 4: Keep going...
        ~5-6 hops → entire network of thousands of nodes has it

Like a rumor spreading through a school:
  You tell 5 friends, each tells 5 more friends,
  within an hour the whole school knows.
```

### Visualizing Propagation

```
Hop 0:   ● Alice's node
         │
Hop 1:   ● ● ● ● ● ● ● ●      (8 nodes)
         │ │ │ │ │ │ │ │
Hop 2:   ●●●●●●●●●●●●●●●●...  (64 nodes, minus duplicates)
         │││││││││││││││││
Hop 3:   ...                   (hundreds of nodes)
         │
Hop 4:   ...                   (thousands of nodes)
         │
Hop 5:   entire network reached

Bitcoin:  new block reaches 90% of network in ~2 seconds
Ethereum: similar propagation speed
```

### Deduplication — Avoiding Infinite Loops

```
Problem: If every node forwards to all peers, messages loop forever.

Solution: Nodes remember what they've already seen.

  Node B receives tx_123 from Node A
    → validates it
    → adds tx_123 to "seen" list
    → forwards to peers (except Node A)

  Later, Node C sends tx_123 to Node B
    → Node B checks "seen" list
    → already have it → DROP. Don't forward again.

This stops the infinite loop.
```

### Compact Block Relay (Bitcoin Optimization)

```
Problem: Full blocks can be 1-4MB. Broadcasting to hundreds of
         peers wastes bandwidth.

Solution: Compact Block Relay (BIP 152)

  Instead of sending the full block:
    1. Send just the block header + short tx IDs
    2. Receiving node checks which txs it already has in mempool
       (it probably already got most txs via gossip)
    3. Only request the txs it's missing (usually very few)

  Result: instead of 1MB, often only ~10KB is transmitted
          because most nodes already have the transactions.
```

---

## 4. The Network Stack

### What Protocols Blockchains Use

```
Layer 3 (Internet):  IP
Layer 4 (Transport): TCP/IP (reliable, ordered delivery)
Layer 7 (App):       Custom P2P protocol per blockchain

Bitcoin uses:  its own custom protocol over TCP port 8333
Ethereum uses: DevP2P (their custom P2P framework)
               libp2p (used by many modern chains)
Cosmos uses:   libp2p / CometBFT's P2P layer
Solana uses:   QUIC protocol (UDP-based, faster than TCP)
```

### What Gets Transmitted

```
Through the P2P network, nodes share:

  1. Transactions       → newly submitted by users
  2. Blocks            → newly produced by miners/validators
  3. Block headers      → lightweight chain sync
  4. Peer addresses     → who else is on the network
  5. Mempool data       → transaction gossip
  6. Sync data          → when new nodes download history

Different message types have different propagation rules.
Transactions gossip freely.
Blocks propagate with priority.
```

---

## 5. Node Types

Not every node does the same job. There are different types,
each with different storage requirements and roles.

### Full Node

```
What it stores:
  - Every block from genesis to now
  - Every transaction ever
  - Current state (all account balances, contract storage)
  - Validates EVERYTHING independently

What it does:
  - Verifies every block and every transaction
  - Doesn't trust anyone — checks everything itself
  - Serves data to other nodes (light clients, new nodes syncing)
  - Relays transactions and blocks

Storage requirement:
  Bitcoin full node:   ~600 GB (2024)
  Ethereum full node:  ~1 TB+ (2024, growing fast)

Who runs them:
  Exchanges, wallets, developers, privacy-conscious users,
  anyone who wants true verification without trusting a third party

Why they matter:
  Full nodes are the backbone of the network.
  They enforce the rules.
  If a miner/validator produces an invalid block,
  full nodes reject it — even if it has valid PoW/PoS.
  
  "Not your node, not your verification."
```

### Light Node (SPV Node)

```
SPV = Simplified Payment Verification (Bitcoin term)

What it stores:
  - Block HEADERS only (not full blocks, not transactions)
  - NOT the full state

What it does:
  - Downloads only block headers (~80 bytes per block for Bitcoin)
  - Verifies that a transaction is included using Merkle proofs (from 1.1!)
  - Asks full nodes for specific transaction data when needed
  - Does NOT independently verify all transactions

Storage requirement:
  Bitcoin headers only:  ~60 MB for ALL of history (vs 600 GB)
  Massive difference.

How it verifies transactions:
  1. Has the block header (which contains the merkle_root)
  2. Asks a full node for the Merkle proof for tx X
  3. Recomputes the path: hash(tx) → ... → merkle_root
  4. Checks: computed root == header's merkle_root?
  5. Also checks: does the block header have valid PoW?
  → Transaction is verified without downloading all transactions

Who runs them:
  Mobile wallets, embedded devices, anything resource-constrained

Tradeoff:
  ✓ Very lightweight
  ✗ Trusts that full nodes are telling the truth about which
    transactions exist (can't verify ones that DON'T exist)
  ✗ Less privacy (asks full nodes about specific addresses)
```

### Archive Node

```
What it stores:
  - Everything a full node stores
  - PLUS every historical state at every block height

What does "historical state" mean?

  Full node:    "Alice's balance is 10 ETH right now"
  Archive node: "Alice's balance at block 15,000,000 was 10 ETH
                 Alice's balance at block 14,999,999 was 11 ETH
                 Alice's balance at block 14,999,998 was 11 ETH
                 ..."

  Every state at every block, all the way back to genesis.

Storage requirement:
  Ethereum archive node:  10+ TB (and growing)
  Very expensive to run.

Who runs them:
  Block explorers (Etherscan needs to answer "what was this 
                   balance at block X?")
  Analytics platforms
  Researchers
  Some DeFi protocols that need historical data

Who does NOT need them:
  Regular users, wallets, most dApps
  Full nodes can serve 99% of use cases.
```

### Validator Node / Miner Node

```
What it does:
  - Everything a full node does
  - PLUS participates in consensus (proposes/mines blocks)
  - PLUS signs votes (PoS) or mines (PoW)

Bitcoin miner:
  Runs full node + mining hardware (ASICs)
  Competes to find the valid nonce

Ethereum validator:
  Runs full node + validator client (separate software)
  Stakes 32 ETH
  Gets randomly selected to propose blocks and attest

Cosmos validator:
  Runs full node + signing key
  Stakes tokens (or receives delegations)
  Participates in Tendermint rounds

Extra requirements:
  - High uptime (going offline = missed rewards or slashing)
  - Good hardware (fast block production)
  - Reliable internet (block propagation speed matters)
  - Security (private key must never be exposed)
```

### Summary Table

```
Node Type    | Stores Full Blocks | Stores All States | Validates | Produces Blocks
─────────────┼────────────────────┼───────────────────┼───────────┼────────────────
Full Node    | Yes                | Current only      | Yes       | No
Light Node   | Headers only       | No                | Partial   | No
Archive Node | Yes                | ALL historical    | Yes       | No
Validator    | Yes                | Current only      | Yes       | YES
```

---

## 6. How a New Node Syncs

When you install a Bitcoin or Ethereum node for the first time,
you have nothing. How do you get the entire history?

### Initial Block Download (IBD)

```
Step 1: Connect to peers via seed nodes

Step 2: Ask peers for block headers first
        → validate the chain of headers
        → confirm you have the right chain (matching genesis + most work)

Step 3: Download full blocks in parallel from multiple peers
        → verify each block fully (all txs, all signatures, PoW/PoS)

Step 4: Build up your local state by executing every transaction
        from genesis to now

This takes:
  Bitcoin:  hours to days (depending on hardware + internet)
  Ethereum: days (state is much larger and more complex)
```

### Snapshot Sync (Ethereum)

```
Downloading and executing everything from genesis is very slow.

Modern Ethereum clients offer SNAP SYNC:

  Instead of replaying all 10+ years of transactions:
  1. Download recent block headers first
  2. Download a SNAPSHOT of the current state directly
     (who owns what right now, without replaying history)
  3. Download recent blocks and validate forward from snapshot

  Result: sync in hours instead of days.
  Tradeoff: you trust the snapshot is correct
            (mitigated by verifying block headers + state root)
```

---

## 7. Real Transaction Journey Through the Network

Now we can trace Alice's transaction through ALL 4 milestones:

```
Alice signs "send 1 ETH to Bob"          ← Cryptography (1.1)
  │
  │ broadcasts to her peers
  ▼
Gossip spreads tx across the network     ← Networking (1.4)
  │
  │ reaches all mempools
  ▼
Proposer selected for this slot          ← Consensus (1.3)
  │
  │ picks tx from mempool, builds block
  ▼
Block proposed, validators attest        ← Consensus (1.3)
  │
  │ >= 2/3 attest → block accepted
  ▼
Block gossiped to all nodes              ← Networking (1.4)
  │
  │ each node verifies and applies
  ▼
State updated: Alice -1 ETH, Bob +1 ETH ← Blockchain Core (1.2)
  │
  │ state_root updated in next block header
  ▼
After 2 epochs: block finalized          ← Consensus (1.3)
```

Everything clicks together now.

---

## 8. Key Takeaways

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  P2P Network    → No central server. Every node talks        │
│                   directly to peers. No single point of      │
│                   failure or control.                         │
│                                                               │
│  Peer Discovery → Bootstrap nodes → peer exchange.           │
│                   New nodes find others via seed nodes        │
│                   then build their own address book.          │
│                                                               │
│  Gossip Protocol → Data spreads exponentially.               │
│                    Each node forwards to peers.               │
│                    Whole network reached in seconds.          │
│                    Deduplication prevents infinite loops.     │
│                                                               │
│  Full Node      → Stores everything. Validates everything.   │
│                   The backbone of the network.                │
│                                                               │
│  Light Node     → Headers only. Uses Merkle proofs.          │
│                   For resource-constrained devices.           │
│                                                               │
│  Archive Node   → Full node + ALL historical states.         │
│                   For block explorers and analytics.          │
│                                                               │
│  Validator Node → Full node + consensus participation.       │
│                   Proposes and signs blocks.                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer without scrolling up:

1. What is the difference between client-server and P2P architecture?
2. How does a brand new node find its first peers?
3. Explain gossip protocol in your own words. Why doesn't it loop forever?
4. What is the difference between a full node and a light node?
5. Why would anyone run an archive node? Who needs it?
6. What extra responsibilities does a validator node have over a full node?
7. A light node wants to verify that tx X is in block 800,000.
   It has all block headers. What does it need from a full node,
   and how does it verify without downloading the full block?
8. Why does Ethereum sync take longer than Bitcoin sync?

---

## Next

→ **Milestone 1.5: Accounts & Transactions** — UTXO vs Account model, nonce/sequence,
  transaction lifecycle, gas & fees
