# Milestone 1.5: Accounts & Transactions — UTXO vs Account Model, Nonce, Gas & Fees

---

## Why This Comes Next

You now know:
- cryptography secures ownership (1.1)
- blocks and chains store history (1.2)
- consensus decides the next block (1.3)
- networking spreads data across nodes (1.4)

But we've been hand-waving over a key question:

**How exactly does "Alice sends 1 ETH to Bob" work under the hood?**

What is a transaction structurally?
How does the chain track who owns what?
Why do transactions sometimes fail?
What is gas and why does it exist?

This milestone answers all of that.

---

## 1. Two Models of Ownership

There are two fundamentally different ways a blockchain can track who owns what.

### Model 1: UTXO (Bitcoin)

UTXO = Unspent Transaction Output

**The mental model: physical cash**

```
Think of UTXOs as physical coins and bills in your wallet.

Alice's wallet:
  UTXO_1: 0.5 BTC  (received from Bob, tx: 0xaaa)
  UTXO_2: 0.3 BTC  (received from Charlie, tx: 0xbbb)
  UTXO_3: 0.2 BTC  (received as mining reward, tx: 0xccc)

Alice's "balance" = 0.5 + 0.3 + 0.2 = 1.0 BTC

But there is NO field anywhere that says "Alice: 1.0 BTC"
There are just three separate unspent coins sitting there.
```

**How spending works:**

```
Alice wants to send 0.6 BTC to Dave.

Problem: she has no single UTXO worth exactly 0.6 BTC.
Solution: combine UTXOs, send the right amount, get change back.

Transaction:
  INPUTS  (UTXOs being consumed / destroyed):
    UTXO_1: 0.5 BTC  (Alice's coin from Bob)
    UTXO_2: 0.3 BTC  (Alice's coin from Charlie)
    Total input: 0.8 BTC

  OUTPUTS (new UTXOs being created):
    UTXO_new1: 0.6 BTC → Dave's address    (payment)
    UTXO_new2: 0.19 BTC → Alice's address  (change back to Alice)
    Fee: 0.01 BTC → miner                  (input - output = fee)

After the transaction:
  UTXO_1 and UTXO_2 are SPENT (destroyed, removed from UTXO set)
  UTXO_new1 and UTXO_new2 are UNSPENT (created, added to UTXO set)
  UTXO_3 is untouched (Alice still has it)
```

**Visualizing UTXO flow:**

```
[Bob] ──────────────────────────────► UTXO_1 (0.5 BTC) ──┐
[Charlie] ──────────────────────────► UTXO_2 (0.3 BTC) ──┤
                                                           │
                                            TX_send_dave  │
                                                           ├──► UTXO_new1 (0.6 BTC) → Dave
                                                           ├──► UTXO_new2 (0.19 BTC) → Alice
                                                           └──► 0.01 BTC fee → Miner

UTXO_3 (0.2 BTC) untouched, still owned by Alice
```

**Key rules:**
```
1. Every input must be a valid unspent output (can't spend already-spent coins)
2. Every input must be signed by its owner
3. Sum of outputs <= Sum of inputs (difference = miner fee)
4. A UTXO is either FULLY spent or not spent at all (no partial spending)
```

**Why Bitcoin chose UTXO:**
```
✓ Very simple state: just a set of unspent coins
✓ Easy to verify: just check if inputs are unspent
✓ Privacy: each tx can use a fresh address for change
✓ Parallel validation: independent UTXOs can be processed simultaneously
✗ More complex for users (wallet software hides this complexity)
✗ Not natural for smart contracts (hard to have "account balance" state)
```

### HD Wallets — One Key, Many Addresses

Modern Bitcoin wallets don't generate just ONE address.
They use **HD Wallets (Hierarchical Deterministic — BIP32 standard)**
to derive thousands of addresses from a single master key.

```
Seed phrase (12 or 24 words)
      │
      ▼
Master Private Key
      │
      ├──► Address_1: 1A1zP1...  ← receive from Bob
      ├──► Address_2: 1BpEi6...  ← receive from Charlie
      ├──► Address_3: 1Dky3...   ← change from your own tx
      ├──► Address_4: 1Feex...   ← next payment
      ...thousands more

All controlled by the same master key.
Alice can spend from ANY of them.
From OUTSIDE they look like completely different people.
```

Modern wallets automatically generate a fresh address every time
you click "Receive." You never manage addresses manually.

### UTXO Privacy — Harder to Link, Not Truly Private

Both Bitcoin and Ethereum are fully public. Every transaction is
visible to anyone. The difference is how hard it is to LINK them.

```
Bitcoin (harder to link):
  Alice uses Address_1 for tx 1
  Alice uses Address_2 for tx 2
  Alice uses Address_3 for tx 3

  Each tx looks unrelated on chain.
  Outside world sees three disconnected addresses.
  Looks like three different people.

Ethereum (easier to link):
  Every tx Alice sends shows "from: 0x742d..." explicitly.
  One address, all history in one place.
  Anyone can look up 0x742d... on Etherscan → full history visible.
```

**But Bitcoin is NOT truly private either.**

### How Chainalysis Links Bitcoin Transactions

Companies like Chainalysis make millions tracing Bitcoin using heuristics:

**Heuristic 1: Common Input Ownership**
```
Alice's transaction:
  INPUT_1: 0.5 BTC from Address_1
  INPUT_2: 0.3 BTC from Address_2
  OUTPUT:  0.7 BTC → Bob

Chainalysis logic:
  "To spend BOTH inputs in ONE transaction, the sender must own
   private keys for BOTH Address_1 AND Address_2.
   Therefore they belong to the same person."

Most powerful heuristic. Combining UTXOs reveals shared ownership.
```

**Heuristic 2: Change Address Detection**
```
  INPUT:   0.5 BTC from Address_1
  OUTPUT1: 0.4 BTC → Bob         (round number → payment)
  OUTPUT2: 0.09 BTC → Address_2  (odd amount → change)

  "The change likely belongs to the sender."
  Address_1 and Address_2 are now linked.
```

**Heuristic 3: Off-Chain Data (most powerful)**
```
  Alice buys BTC on Coinbase → KYC'd (passport, selfie)
  Coinbase sends BTC to Alice's Address_1.

  Now Chainalysis knows: Address_1 = Alice

  They trace forward using heuristics:
    Address_1 → Address_2 (common input)
    Address_2 → Address_3 (change detection)
    ...entire history traced from ONE KYC anchor

Other off-chain sources:
  - IP address when broadcasting tx
  - Forum posts sharing addresses
  - Darknet market seizures
  - Dusting attacks: send tiny amounts to many addresses,
    watch where they get combined → reveals ownership links
```

**True privacy requires extra tools:**
```
Bitcoin:   CoinJoin (multiple people combine inputs → common input heuristic fails)
           Lightning Network (off-chain, not on the main chain)
Ethereum:  zkSNARK-based privacy solutions
Monero:    Private by DEFAULT (ring signatures, stealth addresses)
Zcash:     Private by DEFAULT (zk-SNARKs)
```

---

### Model 2: Account Model (Ethereum)

**The mental model: a bank account**

```
Ethereum's state is just a big database of accounts:

  Address             | Balance  | Nonce | Code     | Storage
  ──────────────────────────────────────────────────────────────
  0x742d... (Alice)   | 10 ETH   | 5     | (none)   | (none)
  0x891f... (Bob)     | 3 ETH    | 2     | (none)   | (none)
  0xUSDC... (Contract)| 0 ETH    | 0     | bytecode | {balances: {...}}

Two types of accounts:

  1. Externally Owned Account (EOA)
     → Controlled by a private key (a human or wallet)
     → Has balance and nonce
     → No code, no storage
     → Examples: Alice's wallet, Bob's wallet

  2. Contract Account
     → Controlled by code (no private key)
     → Has balance, nonce, bytecode, and storage
     → Can only act when called by an EOA or another contract
     → Examples: USDC token, Uniswap, any smart contract
```

**How a transfer works:**

```
Alice (0x742d...) sends 1 ETH to Bob (0x891f...)

Before:
  Alice: 10 ETH, nonce: 5
  Bob:   3 ETH,  nonce: 2

Transaction executes:
  Alice.balance  -= 1 ETH + fee
  Alice.nonce    += 1           (now 6)
  Bob.balance    += 1 ETH

After:
  Alice: 8.999 ETH, nonce: 6
  Bob:   4 ETH,     nonce: 2

Simple. Direct balance update. No UTXOs. No change outputs.
```

**Why Ethereum chose Account model:**
```
✓ Simple mental model (like a bank account)
✓ Natural for smart contracts (contracts have their own balance/storage)
✓ Easy to check balance: one lookup in state
✗ More complex state management
✗ Less privacy (one address = one persistent identity)
✗ Harder to parallelize (accounts can interact with each other)
```

---

### UTXO vs Account Side by Side

```
                    UTXO (Bitcoin)          Account (Ethereum)
                    ──────────────          ──────────────────
Mental model:       Physical cash           Bank account
State:              Set of unspent coins    Database of accounts
Balance check:      Sum all your UTXOs      One lookup
Transfer:           Destroy inputs,         Update two balances
                    create outputs
Change:             Explicit change output  No change needed
Smart contracts:    Very hard               Natural fit
Parallelism:        Easy (independent)      Harder (shared state)
Privacy:            Better (fresh addrs)    Worse (persistent addr)
Used by:            Bitcoin, Litecoin       Ethereum, Solana, Cosmos
```

---

## 2. Nonce — Preventing Replay Attacks

### What is a Nonce?

In the account model (Ethereum), every account has a **nonce** — a counter
that increments by 1 with every transaction sent.

```
Alice's account:
  nonce: 0   (just created, never sent a tx)

Alice sends tx 1:
  nonce in tx: 0
  After tx: Alice's nonce becomes 1

Alice sends tx 2:
  nonce in tx: 1
  After tx: Alice's nonce becomes 2

Alice sends tx 3:
  nonce in tx: 2
  After tx: Alice's nonce becomes 3
```

### Why Nonces Are Critical

**Problem 1: Replay Attack**

```
Without nonces:

  Alice signs: "send 1 ETH to Bob"
  Bob receives 1 ETH. ✓

  Bob is malicious. He takes Alice's signed transaction
  and broadcasts it again... and again... and again.

  Each time: Alice loses 1 ETH.
  Nothing stops Bob from draining Alice's entire wallet.

With nonces:

  Alice's tx has nonce=5.
  Node processes it. Alice's nonce becomes 6.

  Bob replays the tx with nonce=5.
  Node checks: Alice's current nonce is 6.
  5 ≠ 6 → REJECT. Replay blocked. ✓
```

**Bonus: Cross-Chain Replay (EIP-155)**
```
Without chain ID in signatures:

  Ethereum forked into ETH and ETC in 2016.
  Alice signs a tx on Ethereum mainnet.
  That SAME signed tx is valid on Ethereum Classic too.
  Her tx automatically replays on the other chain.
  She loses ETH on BOTH chains without intending to.

EIP-155 fix:
  Chain ID is now included in the signature itself.
  Ethereum mainnet = chain ID 1
  Ethereum Classic = chain ID 61
  Goerli testnet   = chain ID 5

  A tx signed for mainnet (chain ID 1) is cryptographically
  invalid on any other chain. Replay impossible.
```

**Problem 2: Transaction Ordering**

```
Alice sends 3 transactions quickly:
  tx A: nonce=5, send 1 ETH to Bob
  tx B: nonce=6, send 0.5 ETH to Charlie
  tx C: nonce=7, send 0.2 ETH to Dave

If tx B arrives before tx A:
  Node sees nonce=6 but current nonce is 5
  → tx B goes to mempool but waits for nonce=5 to come first

  Once tx A arrives (nonce=5) → processed
  Then tx B (nonce=6) → processed
  Then tx C (nonce=7) → processed

Nonces enforce strict ordering of your own transactions.
```

**Problem 3: Transaction Replacement**

```
Alice accidentally sent a tx with too low a fee.
It's stuck in mempool.

She can REPLACE it by sending the same nonce with higher fee:

  Original: nonce=5, fee=0.001 ETH (stuck)
  Replace:  nonce=5, fee=0.01 ETH  (higher fee, same nonce)

Miners drop the original and pick up the replacement.
This is called "Replace By Fee" (RBF).
Only works because nonces are unique per account.
```

### UTXO and Nonces

```
Bitcoin (UTXO) doesn't need nonces.

Why?
  Each UTXO can only be spent once by design.
  Replay is impossible: spending UTXO_1 destroys it.
  Replaying the same tx tries to spend a destroyed UTXO → rejected.

  Ordering: independent UTXOs can be spent in any order.
  No replay: destroyed UTXOs can't be reused.
  No nonce needed.
```

---

## 3. Transaction Lifecycle — From Creation to Finality

### A Complete Ethereum Transaction

```
{
  from:     "0x742d..."          ← sender's address
  to:       "0x891f..."          ← recipient (EOA or contract)
  value:    1000000000000000000  ← amount in Wei (1 ETH = 10^18 Wei)
  nonce:    5                    ← sender's current nonce
  gas_limit: 21000               ← max gas allowed for this tx
  max_fee:  20 gwei              ← max total fee per gas unit willing to pay
  max_priority_fee: 2 gwei       ← tip to validator per gas unit
  data:     "0x"                 ← empty for simple ETH transfer
                                    (bytecode for contract calls)
  signature: (v, r, s)           ← ECDSA signature from private key
}
```

### Step by Step Lifecycle

```
Step 1: CREATION
  Alice creates the tx object with all fields above.
  Signs it with her private key → produces (v, r, s).
  Her private key never leaves her device.

Step 2: BROADCAST
  Alice's wallet sends the signed tx to a node via JSON-RPC.
  That node gossips it to peers.
  Tx spreads across the network (gossip protocol from 1.4).

Step 3: MEMPOOL VALIDATION
  Each node receiving the tx checks:
    ✓ Signature valid?           (ECDSA verify from 1.1)
    ✓ Nonce correct?             (= account's current nonce)
    ✓ Balance covers value + fee? (account model from above)
    ✓ Gas limit reasonable?
  
  Pass → tx enters mempool
  Fail → tx dropped, not relayed

Step 4: BLOCK INCLUSION
  Proposer/validator selects txs from mempool.
  Picks highest priority fee txs first.
  Includes them in a block up to the gas limit.

Step 5: EXECUTION
  EVM executes the tx:
    Simple ETH transfer: deduct from sender, add to receiver
    Contract call: run bytecode, update contract storage

  If execution SUCCEEDS:
    State changes are applied permanently.
    Fee paid to validator.

  If execution FAILS (e.g. contract throws error):
    State changes are REVERTED.
    Fee is still paid (you pay for computation even if it fails).

Step 6: FINALITY
  Block containing tx gets finalized (consensus from 1.3).
  Tx is now irreversible.
```

### Transaction Failure vs Rejection

```
REJECTION (never enters blockchain):
  Happens at mempool validation.
  Invalid signature, wrong nonce, insufficient balance.
  Tx never appears on chain. No fee paid.

FAILURE (on chain, state reverted):
  Tx is in a block. EVM tries to execute. Something goes wrong.
  Contract runs out of gas / throws an error / condition fails.
  State changes rolled back. But tx IS on the blockchain.
  Fee is NOT refunded. You pay for failed execution.

This surprises many beginners:
  "My tx failed but I still paid $20 in gas?"
  Yes. The computation happened. Nodes did the work.
  They get paid regardless of outcome.
```

### What Exactly Gets Reverted vs What Stays

```
When a transaction FAILS mid-execution:

  REVERTED (undone, as if tx never happened):
    ✓ Balance transfers inside the contract
    ✓ Contract storage updates
    ✓ Any ETH sent inside the contract call
    ✓ Any token transfers inside the contract

  NOT REVERTED (permanent, stays on chain):
    ✗ Gas consumed up to failure point → paid to validator
    ✗ The transaction itself → permanently on blockchain (status: failed)
    ✗ Nonce increment → Alice's nonce still goes up by 1

Example:
  Alice calls a DeFi contract with 200,000 gas limit.
  Contract runs out of gas at operation 150,000.

    150,000 gas → paid to validator (work was done)
    50,000 gas  → refunded to Alice (unused gas returned)
    State       → fully reverted
    Nonce       → incremented (tx happened, even if it failed)
    Tx          → on chain forever, marked FAILED
```

---

## 4. Gas — The Fuel of the EVM

### What is Gas?

Gas is the unit that measures computational work on Ethereum.

```
Every operation has a cost in gas:
  Adding two numbers:           3 gas
  Reading from storage:         2,100 gas
  Writing to storage:           20,000 gas
  Simple ETH transfer:          21,000 gas (flat cost)
  Deploying a contract:         32,000 + bytecode costs gas
  Token transfer (ERC-20):      ~65,000 gas

Gas is NOT ETH. Gas is a unit of work.
ETH is what you pay per unit of gas.
```

### Why Gas Exists

```
Without gas limits:

  Malicious user submits a contract that runs an infinite loop.
  Every node tries to execute it → runs forever → network dies.

With gas:

  Every operation costs gas.
  User sets a maximum gas limit (say 100,000 gas).
  When gas runs out → execution stops → reverted.
  Attacker paid for those 100,000 operations. Can't do it for free.

Gas makes DoS attacks expensive.
It also creates a market for block space.
```

### Gas Price, Base Fee, Priority Fee (EIP-1559)

**Before EIP-1559 (before August 2021) — Auction Model:**
```
Users set a single "gas price" (bid in gwei).
Miners picked highest bidders first.

Problems:
  ✗ Unpredictable fees — you had to guess the right bid
  ✗ During congestion, fees spiked to $200+ per tx
  ✗ Users overpaid massively just to be safe
  ✗ Miners got ALL the fees (no burning)
  ✗ ETH supply kept increasing with no deflationary pressure
```

**EIP-1559 (August 2021) changed this:**

```
Now every transaction specifies:

  base_fee:          Set by the PROTOCOL, not the user.
                     Adjusts automatically based on how full recent blocks were.
                     If blocks are >50% full → base_fee increases
                     If blocks are <50% full → base_fee decreases

  priority_fee:      The TIP you give the validator.
  (max_priority_fee) "Please include me, here's extra."
                     Goes directly to the validator.

  max_fee:           The MAXIMUM you're willing to pay per gas unit.
                     Must be >= base_fee + priority_fee.

  Actual fee paid = (base_fee + priority_fee) × gas_used

  The base_fee is BURNED (destroyed, removed from supply).
  The priority_fee goes to the validator.
```

**Example:**

```
Block base_fee:    15 gwei
Alice sets:
  max_fee:          20 gwei
  max_priority_fee: 2 gwei

Actual fee per gas = 15 (base) + 2 (tip) = 17 gwei
Alice gets back:   (20 - 17) = 3 gwei per gas unit refunded

  Total cost = 17 gwei × 21,000 gas = 357,000 gwei = 0.000357 ETH

The 15 gwei base fee × 21,000 = 315,000 gwei BURNED
The 2 gwei tip × 21,000 = 42,000 gwei to validator
```

**Why burning base fee matters — ETH becoming deflationary:**
```
Every tx burns some ETH (the base fee).
New ETH is created every block as validator rewards (~1,700 ETH/day).

When network is busy:
  Burned ETH > New ETH created → supply DECREASES → ETH deflationary
  (During DeFi summer / NFT booms, billions of $ of ETH was burned)

When network is quiet:
  Burned ETH < New ETH created → supply increases slightly

This is a big shift from pre-Merge Ethereum where ETH was always inflationary.
Bitcoin is deflationary by halvings. ETH is deflationary by usage.
```

### Gas Limit per Block

```
There's a maximum amount of gas allowed per block.

Ethereum:   ~30 million gas per block
Bitcoin:    ~4 MB block size (different concept, similar purpose)

This limits how many transactions fit in one block.
It's why there's competition and fees: limited block space.

When network is busy:
  Many txs in mempool
  → competition for block space
  → users raise priority_fee to get included faster
  → validators earn more
  → expensive to transact

When network is quiet:
  Few txs in mempool
  → base_fee drops automatically
  → cheap to transact
```

### Gas in Bitcoin

```
Bitcoin doesn't use "gas" as a concept.
Instead, Bitcoin uses transaction SIZE (in bytes).

Fee = fee_rate (sat/vbyte) × transaction_size (vbytes)

Miners pick txs with highest sat/vbyte first.

Why size and not computation?
  Bitcoin has NO smart contracts.
  All txs are simple value transfers.
  Computation cost is predictable.
  Size is a reasonable proxy for resource usage.
```

---

## 5. Bitcoin Transaction Structure (UTXO in Detail)

```
Bitcoin Transaction:
{
  version:   2
  inputs: [
    {
      prev_tx_hash: "0xaaa..."   ← which previous tx are we spending?
      prev_output_index: 0       ← which output of that tx?
      script_sig: "..."          ← proof of ownership (signature)
      sequence: 0xFFFFFFFF
    }
  ]
  outputs: [
    {
      value: 60000000            ← 0.6 BTC in satoshis (1 BTC = 100,000,000 sat)
      script_pubkey: "OP_DUP OP_HASH160 <Dave's address> OP_EQUALVERIFY OP_CHECKSIG"
    },
    {
      value: 19000000            ← 0.19 BTC change
      script_pubkey: "OP_DUP OP_HASH160 <Alice's address> OP_EQUALVERIFY OP_CHECKSIG"
    }
  ]
  locktime: 0
}

Fee = sum(inputs) - sum(outputs)
    = 80000000 - (60000000 + 19000000)
    = 1000000 satoshis = 0.01 BTC → goes to miner
```

### Bitcoin Script

```
Bitcoin has a simple scripting language for spending conditions.

Most common: Pay to Public Key Hash (P2PKH)
  To spend: provide signature + public key that hashes to the address.

Others:
  P2SH:    Pay to Script Hash (multisig, etc.)
  P2WPKH:  SegWit (smaller tx, lower fees)
  P2TR:    Taproot (Schnorr signatures, more privacy)

This is NOT a Turing-complete language.
You cannot write loops or complex logic in Bitcoin Script.
That's intentional — keeps it simple and secure.
```

---

## 6. Putting It All Together

```
UTXO model (Bitcoin):

  Alice's wallet = collection of UTXOs
  Spending = destroy some UTXOs, create new ones
  No nonces needed (UTXOs are unique by nature)
  Fees = inputs - outputs
  Validation: is this UTXO unspent? Is the signature valid?


Account model (Ethereum):

  Alice's account = balance + nonce + (code + storage if contract)
  Transfer = update two balances
  Nonce prevents replay attacks and enforces ordering
  Fees = gas_used × (base_fee + priority_fee)
  base_fee burned, priority_fee to validator
  Validation: is signature valid? Is nonce correct? Is balance sufficient?


Transaction lifecycle (both):

  Create + sign → broadcast → mempool validation →
  block inclusion → execution → state update → finality
```

---

## Key Takeaways

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  UTXO         → Cash model. Coins destroyed and created.    │
│                 No accounts, just unspent outputs.           │
│                 Used by Bitcoin.                             │
│                                                              │
│  Account      → Bank model. Balances directly updated.      │
│                 EOAs and contract accounts.                  │
│                 Used by Ethereum.                            │
│                                                              │
│  Nonce        → Counter per account. Prevents replay.       │
│                 Enforces tx ordering. Enables replacement.   │
│                                                              │
│  Gas          → Unit of computation. Makes DoS expensive.   │
│                 base_fee burned. priority_fee to validator.  │
│                                                              │
│  Tx Lifecycle → Create → sign → broadcast → mempool →       │
│                 block → execute → finalize.                  │
│                                                              │
│  Failed tx    → Reverts state. Fee still paid.              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer without scrolling up:

1. Explain UTXO model in your own words. How is Alice's balance calculated?
2. Alice has UTXOs of 0.3 and 0.4 BTC. She wants to send 0.5 BTC to Bob with 0.01 fee.
   Draw the inputs and outputs of this transaction.
3. What is a nonce in Ethereum? Give two problems it solves.
4. Alice's nonce is 7. She sends a tx with nonce=7. Then tries to replay the same tx. What happens?
5. What is gas? Why does it exist?
6. In EIP-1559, what happens to the base fee? What happens to the priority fee?
7. Why can a failed transaction still cost you money?
8. What is the difference between a transaction being REJECTED vs FAILING?
9. Why doesn't Bitcoin need nonces?
10. An EOA and a contract account — what are the differences?

---

## Next

→ **Milestone 1.6: Architecture** — EVM vs non-EVM, Solana runtime (Sealevel),
  Cosmos SDK (ABCI), modular vs monolithic blockchains
