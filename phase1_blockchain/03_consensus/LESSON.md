# Milestone 1.3: Consensus - How Distributed Systems Agree

---

## Why This Comes Next

You now know:
- a blockchain is a chain of hashed blocks
- blocks carry transactions
- transactions update state

That still leaves the hardest question:

**Who gets to decide the next block?**

If 10,000 nodes are spread across the world, messages arrive late, some nodes
crash, and some act maliciously, how do they still agree on one history?

That is the job of **consensus**.

Without consensus, a blockchain is just:
- a data structure with no agreement
- a state machine with no shared state
- a network with no source of truth

In this lesson, there are **6 ideas** you need to understand:
1. What consensus actually solves
2. Proof of Work (PoW)
3. Proof of Stake (PoS)
4. Delegated Proof of Stake (DPoS)
5. Byzantine Fault Tolerance (BFT)
6. How Tendermint/CometBFT and Solana's PoH + Tower BFT fit together

---

## 1. What Consensus Actually Means

### Simple Definition

Consensus is the process by which many nodes agree on:
- which transactions are accepted
- in what order they happened
- which block is the next valid block
- what the new state is after applying those transactions

You can think of it like this:

```
Same blockchain state machine
          +
Many nodes
          +
Untrusted environment
          =
Need a rule for agreement
```

### What Problem Is Consensus Solving?

Suppose Alice broadcasts a transaction. Different nodes may see it at different
times. Two miners or validators may try to produce different next blocks.

```
Node A sees tx order: [tx1, tx2, tx3]
Node B sees tx order: [tx2, tx1, tx3]
Node C sees tx order: [tx3, tx1, tx2]

If they all append blocks independently without coordination:
  -> three different chains
  -> three different states
  -> no blockchain, just chaos
```

Consensus gives them a way to converge on **one canonical history**.

### Consensus Is Not the Same as "Validation"

This distinction matters:

```
Validation asks:
  "Is this transaction or block valid according to the rules?"

Consensus asks:
  "Out of all valid possibilities, which one do we all agree to accept next?"
```

Example:
- A transaction may be perfectly valid.
- But if it arrives too late, it might miss the next block.
- Another valid transaction may get ordered before it.

So consensus is not just validity. It is **agreement on ordering and history**.

### The 5 Properties That Matter

#### Property 1: Safety

Honest nodes should not finalize two conflicting histories.

```
Bad outcome:
  Node A says Block 100 is final
  Node B says a different Block 100 is final

If both are final, money can be double-spent.
Safety means this must not happen.
```

#### Property 2: Liveness

The chain must keep making progress.

```
If everyone waits forever and no block ever gets finalized,
the system is "safe" but useless.
```

#### Property 3: Fault Tolerance

The system should still work even if some nodes:
- crash
- go offline
- send bad data
- try to cheat

#### Property 4: Sybil Resistance

In an open network, anyone can create 1,000 fake nodes.
Consensus must stop "one human pretending to be many nodes" from taking over.

PoW solves this with **computational work**.
PoS solves this with **economic stake**.

#### Property 5: Finality

At some point, a block should become too hard or impossible to reverse.

There are two broad kinds:

```
Probabilistic finality:
  The more blocks built on top, the safer it becomes.
  Example: Bitcoin

Deterministic / economic finality:
  Once enough votes are committed, the block is final.
  Example: Tendermint, many PoS+BFT systems
```

### The Adversary: Byzantine Behavior

In distributed systems, a node is called **Byzantine** if it can behave
arbitrarily:
- lie
- send conflicting messages
- go silent
- follow the rules sometimes and cheat other times

This is worse than a normal crash.

```
Crash fault:
  "I stopped responding."

Byzantine fault:
  "I told Alice one thing, Bob another thing, forged messages,
   and tried to make both sides disagree."
```

Blockchains are built assuming Byzantine behavior is possible.

---

## 2. Proof of Work (PoW)

### The Core Idea

Proof of Work says:

> To propose the next block, prove you spent real computational effort.

In Bitcoin, miners repeatedly hash the block header with different nonces
until they find a hash below a difficulty target.

```
Find nonce such that:

  SHA-256(block_header) < target

This is easy to verify:
  anyone hashes once and checks the result

But hard to produce:
  miner may need trillions of attempts
```

### What Mining Actually Is

Mining is not "solving a math puzzle" in the classroom sense.
It is just repeated hashing.

```
Candidate block:
  prev_hash
  merkle_root
  timestamp
  nonce = 0

Try:
  hash(header with nonce 0)
  hash(header with nonce 1)
  hash(header with nonce 2)
  ...
  hash(header with nonce 2083236893)

If hash < target:
  block found
Else:
  keep going
```

### Why PoW Works

PoW converts consensus power into a scarce external resource:
**electricity + hardware + time**.

To attack the chain, you do not just need fake identities.
You need more real-world hashing power than the honest network.

That is the security idea.

### Block Production in PoW

```
Users create signed transactions
          │
          ▼
       Mempool
          │
          ▼
Miner picks txs with best fees
          │
          ▼
Build candidate block header
          │
          ▼
Hash, hash, hash, hash, hash...
          │
          ▼
One miner finds valid nonce
          │
          ▼
Broadcast block
          │
          ▼
Other nodes verify:
  - all txs valid?
  - merkle root correct?
  - prev_hash correct?
  - hash < target?
          │
          ▼
If valid, extend the chain
```

### Difficulty Adjustment

If blocks are found too quickly, the protocol raises difficulty.
If blocks are found too slowly, it lowers difficulty.

In Bitcoin, this keeps block production near the target interval
(about 10 minutes on average).

```
More total hashpower on network
  -> blocks would arrive too fast
  -> protocol increases difficulty

Less total hashpower
  -> blocks would arrive too slow
  -> protocol decreases difficulty
```

### Longest Chain Rule (More Precisely: Most Accumulated Work)

When forks happen in PoW, nodes follow the chain with the most cumulative work.

```
Block 100
   │
   ├── Block 101A
   │      └── Block 102A
   │             └── Block 103A   <- more total work, wins
   │
   └── Block 101B
          └── Block 102B          <- abandoned branch
```

This is how temporary forks resolve.

### Why PoW Finality Is Probabilistic

A Bitcoin block is never "mathematically impossible" to reverse.
It just becomes more expensive with every new block on top.

```
1 confirmation  -> weak confidence
3 confirmations -> stronger
6 confirmations -> very strong for normal payments
```

To reverse a deep transaction, an attacker must re-mine the old block and catch
up with the honest chain.

### The 51% Attack

If an attacker controls more than half of the network's total hashpower,
they can often outpace the honest chain.

That enables attacks like:
- privately mining a competing chain
- double-spending their own coins
- censoring some transactions

But even then, they still cannot:
- forge other people's signatures
- create coins outside the protocol rules
- spend coins they do not control

Consensus controls **ordering/history**.
Cryptography still controls **ownership**.

### Strengths of PoW

```
✓ Very battle-tested
✓ Simple security model: work is expensive
✓ Open participation: anyone with hardware can mine
✓ Hard to fake with just many identities
```

### Weaknesses of PoW

```
✗ High energy cost
✗ Slow finality
✗ Temporary forks are normal
✗ Specialized hardware tends to centralize mining
✗ Throughput is limited
```

---

## 3. Proof of Stake (PoS)

### The Core Idea

Proof of Stake says:

> Consensus power comes from capital locked in the protocol, not from burning
> electricity.

Instead of miners spending energy, validators lock tokens as **stake**.
If they behave honestly, they earn rewards.
If they cheat, they can lose stake through **slashing**.

### The Mental Model

```
PoW:
  "Show me you spent work."

PoS:
  "Show me you have value at risk."
```

### Generic PoS Flow

Different PoS chains use different details, but the broad structure is:

```
1. Users lock tokens to become validators (or to delegate to validators)
2. Protocol selects a block proposer for a slot/round
3. Other validators verify and vote/attest
4. If enough stake agrees, the block is accepted/finalized
5. Honest validators earn rewards
6. Dishonest validators can be penalized or slashed
```

### Why Stake Creates Security

To attack PoS, you need control over a large amount of the token supply.
That is expensive.

And unlike PoW, where energy is spent continuously, PoS can directly punish
misbehavior by destroying or locking an attacker's stake.

```
Attack in PoW:
  burn electricity to out-hash the network

Attack in PoS:
  buy/control huge stake
  risk getting slashed if you equivocate or violate rules
```

### What Slashing Means

Slashing is a protocol-level financial penalty.

Typical slashable behavior:
- signing two conflicting blocks for the same height/slot
- signing two conflicting votes
- surrounding or violating protocol vote rules

```
Honest validator:
  follows protocol -> earns rewards

Dishonest validator:
  signs conflicting messages -> loses stake
```

This is why PoS is often called **economic security**.

### Why PoS Is Not One Single Protocol

This is important:

**PoS is a family of systems, not one exact algorithm.**

Different chains combine stake with different consensus engines:
- Nakamoto-style PoS chains
- PoS + BFT voting
- slot-based proposer systems
- committee-based systems

So when someone says "PoS", you should ask:

```
How are validators chosen?
How are votes counted?
When is finality reached?
What gets slashed?
How are forks resolved?
```

### Strengths of PoS

```
✓ Much lower energy use than PoW
✓ Faster block times are possible
✓ Stronger finality can be built in
✓ Attacks can be punished directly with slashing
```

### Weaknesses / Challenges of PoS

```
✗ Wealth concentration can centralize stake
✗ Protocol design is more complex than PoW
✗ Long-range and governance-related attacks need careful handling
✗ Slashing and validator operations are operationally complex
```

### Two Attacks You Should Know

#### Nothing-at-Stake (Historical Concern)

In naive PoS, if it is free to sign every competing fork, validators might vote
on all forks because there is no electricity cost like PoW.

Modern PoS designs solve this with:
- slashing
- lockouts
- checkpointing/finality rules

#### Long-Range Attacks

If old validators who no longer have stake could rewrite ancient history,
new nodes might be tricked by a fake long fork.

Modern PoS systems defend with:
- finalized checkpoints
- trusted weak subjectivity checkpoints
- rules about recent validator sets

The exact solution depends on the chain.

---

## 4. Delegated Proof of Stake (DPoS)

### The Core Idea

DPoS says:

> Token holders do not all validate directly. Instead, they elect a small set
> of delegates/validators to produce blocks on their behalf.

So DPoS is not "everyone staking and validating equally."
It is **representative consensus**.

### How It Works

```
Token holders vote
      │
      ▼
Elect a limited validator/delegate set
      │
      ▼
Delegates take turns producing blocks
      │
      ▼
Bad delegates can be voted out
```

A chain might have a small active set such as:
- 21 validators
- 50 validators
- 100 validators

The exact number depends on the protocol.

### Why DPoS Exists

A smaller validator set can:
- reduce communication overhead
- increase throughput
- reduce latency

But it does that by trading away some decentralization.

### Strengths of DPoS

```
✓ Fast block production
✓ Small validator set is easier to coordinate
✓ Governance can replace poor performers
```

### Weaknesses of DPoS

```
✗ More politically centralized
✗ Validator cartels are easier to form
✗ Token voting power often concentrates in whales/exchanges
✗ Feels closer to "elected operators" than open participation
```

### PoS vs DPoS

Do not mix these up.

```
PoS:
  stake determines consensus weight
  validator set may be broad or narrow depending on protocol

DPoS:
  token holders explicitly elect a smaller delegate set
  delegates usually produce blocks in scheduled order
```

DPoS is a **specific governance-heavy form of stake-based consensus**.

---

## 5. Byzantine Fault Tolerance (BFT)

### The Core Idea

BFT protocols are designed to let a distributed system reach agreement even if
some participants are Byzantine.

This is where blockchains become more than just "longest chain wins."

### The Famous Rule: 3f + 1

In a classic BFT system:

```
If the network has:
  n = 3f + 1 validators

then it can tolerate:
  f Byzantine validators
```

Examples:

```
4 validators  -> tolerate 1 faulty
7 validators  -> tolerate 2 faulty
10 validators -> tolerate 3 faulty
100 validators -> tolerate 33 faulty
```

Why not 50%?
Because with Byzantine behavior, nodes can send conflicting messages.
You need a stronger threshold than a simple majority.

### The Supermajority Rule: 2/3

BFT systems usually require about **two-thirds** of voting power to commit.

```
Commit threshold:
  >= 2/3 of total voting power
```

This is not arbitrary.

If two different blocks each got 2/3 of votes, those voter sets would have to
overlap. Since not all overlapping validators can be Byzantine, at least one
honest validator would need to have signed conflicting blocks, which honest
validators do not do.

That intersection is what protects safety.

### Why 2/3 Protects Safety

Assume:

```
Total validators = 3f + 1
Faulty validators = at most f
Commit quorum = 2f + 1
```

Take two quorums:

```
Quorum A = 2f + 1
Quorum B = 2f + 1

Overlap must be at least:
  (2f + 1) + (2f + 1) - (3f + 1)
  = f + 1
```

But only `f` validators can be Byzantine.
So among the `f + 1` overlap, at least **one must be honest**.

That honest validator cannot commit two conflicting blocks.

So two conflicting commits cannot both happen.

That is the heart of BFT safety.

### Typical BFT Round

A BFT protocol usually looks something like:

```
1. Propose
   One validator proposes a block

2. Vote round 1
   Validators say: "I saw this proposal and it is the block I support"

3. Vote round 2
   Validators say: "I am ready to commit this block"

4. Commit
   If threshold reached, block becomes final
```

This is the general pattern behind protocols like PBFT and Tendermint-style
consensus.

### Deterministic Finality

Unlike PoW, BFT systems aim for finality as part of the protocol.

```
PoW:
  "This block is probably final after enough confirmations."

BFT:
  "This block reached commit threshold. It is final now."
```

That is a huge conceptual difference.

### Strengths of BFT

```
✓ Fast finality
✓ Strong safety guarantees
✓ No need to wait for many confirmations
```

### Weaknesses of BFT

```
✗ More communication between validators
✗ Works best with a bounded validator set
✗ Can stall if too many validators are offline
✗ Harder to scale to huge global validator sets naively
```

### Very Important Mental Model

BFT and PoS are not competitors in all cases.
They often work together.

Think of it like this:

```
PoS answers:
  "Who gets voting power?"

BFT answers:
  "How do the voters reach agreement safely?"
```

That is exactly how many modern chains are designed.

---

## 6. Tendermint / CometBFT (Cosmos Style)

### What It Is

Tendermint Core, now called **CometBFT**, is the consensus engine used in the
Cosmos ecosystem.

It combines:
- a validator set weighted by stake
- a BFT voting process
- immediate finality once enough votes are collected

So the rough mental model is:

```
Proof of Stake -> chooses validator power
BFT voting     -> reaches agreement
ABCI/app layer -> applies state transitions
```

### Where It Sits in the Stack

```
┌──────────────────────────────────────┐
│ Application State Machine            │
│ Cosmos SDK app / custom blockchain   │
├──────────────────────────────────────┤
│ ABCI                                 │
│ Interface between app and consensus  │
├──────────────────────────────────────┤
│ Tendermint / CometBFT                │
│ Networking + mempool + consensus     │
└──────────────────────────────────────┘
```

The application decides:
- what transactions mean
- how state changes
- what is valid

CometBFT decides:
- who proposes
- how validators vote
- when a block is committed

### The 4 Main Steps

For each height, consensus proceeds roughly as:

```
1. Propose
2. Prevote
3. Precommit
4. Commit
```

Let's unpack them.

### Step 1: Propose

One validator is the proposer for that round.
It takes transactions from the mempool and proposes a block.

```
Height H, Round R
  proposer = Validator 7
  proposed block = B(H,R)
```

### Step 2: Prevote

Validators examine the proposal.

If valid, they prevote for it.
If not, they prevote nil or wait for the next round.

```
Validator checks:
  - block structurally valid?
  - transactions valid?
  - proposer valid?
  - previous commit valid?

If yes:
  prevote(B)
Else:
  prevote(nil)
```

### Step 3: Precommit

If a validator sees `>= 2/3` of voting power prevote the same block,
it becomes confident enough to precommit that block.

```
Seen >= 2/3 prevotes for B
  -> precommit(B)

Seen no supermajority
  -> precommit(nil) / move to next round after timeout
```

### Step 4: Commit

If `>= 2/3` of voting power precommit the same block, the block is committed.

```
>= 2/3 precommits for B
  -> commit B at height H
  -> update state
  -> move to height H+1
```

At that point, the block has finality.

### Why Tendermint Uses Rounds and Timeouts

Networks are asynchronous in practice.
Messages arrive late. A proposer may be offline.

So Tendermint runs in **rounds**:

```
Height 100, Round 0:
  proposer offline -> timeout

Height 100, Round 1:
  new proposer selected
  proposal arrives
  validators prevote / precommit
  block commits
```

This preserves liveness when the first proposer fails.

### Locking - The Safety Mechanism

One of Tendermint's most important ideas is **locking**.

If a validator has already seen enough support for a block in one round, it
should not casually switch to a conflicting block in a later round.

That lock prevents honest validators from helping finalize two different blocks
at the same height.

You do not need all the edge-case details yet.
The key idea is:

```
Locks + 2/3 voting + rounds
  -> strong safety
```

### What Finality Feels Like in Tendermint

In Bitcoin:
- block appears
- wait more blocks
- confidence increases gradually

In Tendermint:
- block gets enough precommits
- block commits
- final

That is why Cosmos-style chains often feel much more "immediate."

### Strengths of Tendermint / CometBFT

```
✓ Deterministic finality
✓ Clear separation between app and consensus
✓ Good fit for app-chains
✓ Fast confirmation experience
```

### Tradeoffs

```
✗ Requires validators to stay well-connected
✗ Validator set is smaller/more bounded than open PoW systems
✗ Communication overhead rises with validator count
```

---

## 7. Solana: PoH + Tower BFT

### The First Important Correction

Many beginners say:

> "Solana uses Proof of History instead of consensus."

That is incorrect.

**Proof of History (PoH) is not consensus by itself.**

PoH is a **cryptographic clock / ordering mechanism**.
Solana still needs validators to vote and agree.
That voting system is **Tower BFT**.

### What Problem PoH Tries to Solve

In distributed systems, agreeing on time and message order is expensive.

Solana's idea:

> Create a verifiable sequence of hashes that proves time passed in a specific
> order.

So instead of every validator constantly arguing about "when" events happened,
they can reference a shared cryptographic timeline.

### What PoH Looks Like

```
seed
  │
  ▼
H1 = hash(seed)
  │
  ▼
H2 = hash(H1)
  │
  ▼
H3 = hash(H2)
  │
  ▼
H4 = hash(H3)
  │
  ▼
...
```

Because each hash depends on the previous one, the sequence must be generated
in order. You cannot jump ahead without doing the work.

This gives a verifiable notion of:
- sequence
- elapsed computation
- ordering anchor for events

### How Transactions Fit Into PoH

The leader can insert transaction data into this running hash stream.

```
PoH stream:
  H1001
  H1002
  H1003 + tx batch A recorded here
  H1004
  H1005 + tx batch B recorded here
```

Now validators can replay the sequence and verify:
- this batch appeared at this point in the timeline
- these entries were ordered this way

### What Tower BFT Is

Tower BFT is Solana's vote-based consensus protocol, inspired by PBFT-style
ideas, but built around the PoH clock.

Very roughly:

```
PoH provides:
  a shared ordered timeline / slots

Tower BFT provides:
  validator voting and commitment rules on top of those slots
```

### Generic Solana Flow

```
1. Leader schedule chooses which validator produces the current slot
2. Leader sequences transactions using PoH
3. Leader broadcasts entries / block data
4. Other validators replay and verify
5. Validators vote on the produced fork/slot
6. Votes create lockouts
7. Enough stake voting on descendants gives stronger and stronger commitment
```

### What Lockouts Mean

In Tower BFT, validators cannot freely vote on every competing fork.
Votes create **lockouts**:

```
Vote on slot S
  -> you are committed for some time
Vote again on descendants
  -> lockout grows
```

This discourages equivocation and helps finality emerge over time.

It is conceptually similar to saying:

```
"If you voted here, switching to a conflicting branch becomes more and more
 expensive / constrained."
```

### Why Solana Can Be Fast

Solana's design tries to reduce coordination overhead by:
- predefining leaders
- using PoH to anchor order/time
- letting validators vote against that ordered stream

So validators spend less time negotiating basic sequencing.

### What Solana Is Really Combining

You should store this exact model in your head:

```
Stake-weighted validator set
        +
Leader schedule
        +
Proof of History (cryptographic clock)
        +
Tower BFT (voting + lockouts)
        =
Solana consensus pipeline
```

### Strengths of Solana's Design

```
✓ High throughput target
✓ Very fast user experience when network is healthy
✓ Efficient ordering model
```

### Tradeoffs

```
✗ Operational complexity is high
✗ Hardware and network demands are much higher
✗ Fast systems are less forgiving of instability
✗ The design is harder to reason about than simpler PoW chains
```

### PoH vs Tendermint Timing - Mental Difference

```
Tendermint:
  validators explicitly coordinate each height/round

Solana:
  ordered time/slots are pushed forward aggressively,
  then validators vote with lockouts on top
```

Both use voting.
They just structure time and coordination differently.

---

## 8. Putting the Models Side by Side

### High-Level Comparison

| Model | Sybil Resistance | Agreement Method | Finality Type | Typical Tradeoff |
|-------|------------------|------------------|---------------|------------------|
| PoW | Hashpower | Longest/heaviest chain | Probabilistic | Secure but slow/energy heavy |
| PoS | Stake | Depends on protocol | Varies | Efficient but more complex |
| DPoS | Stake + elections | Small delegate set | Usually fast | Speed vs decentralization |
| BFT | Usually known validator set | Supermajority voting | Deterministic | Strong finality, limited scale |
| Tendermint/CometBFT | Stake | Propose/prevote/precommit | Deterministic | Great finality, more coordination |
| Solana PoH + Tower BFT | Stake | Voting over PoH-ordered slots | Fast economic/fork-choice based commitment | High performance, high complexity |

### One Very Important Unification

These are not all mutually exclusive categories.

Think of the stack like this:

```
Sybil resistance layer:
  PoW or PoS

Agreement layer:
  longest-chain rule or BFT voting

Execution layer:
  apply transactions to state machine
```

Examples:

```
Bitcoin:
  PoW + longest-chain rule

Cosmos:
  PoS + Tendermint/CometBFT

Solana:
  PoS + PoH ordering + Tower BFT
```

Once this clicks, consensus stops feeling like a bag of random acronyms.

---

## 9. What Consensus Looks Like in a Real Transaction Flow

Let's trace Alice sending a transaction, but this time through the lens of
consensus.

### Case A - Bitcoin / PoW Style

```
1. Alice signs a transaction
2. Nodes validate it and place it in mempools
3. Miners select transactions and build candidate blocks
4. Miners compete by hashing for PoW
5. One miner finds a valid block first
6. Network accepts it if valid
7. More blocks build on top
8. After enough confirmations, transaction is considered final enough
```

### Case B - Cosmos / Tendermint Style

```
1. Alice signs a transaction
2. Validators/nodes check it and place it in mempools
3. Proposer for height H proposes a block
4. Validators prevote
5. Validators precommit
6. >= 2/3 precommits -> block commits
7. State updates immediately
8. Transaction has finality at commit
```

### Case C - Solana Style

```
1. Alice signs a transaction
2. It is forwarded toward the expected leader path
3. Leader sequences it into PoH-ordered entries
4. Validators replay the entries
5. Validators vote under Tower BFT rules
6. Lockouts and descendant votes strengthen commitment
7. State is updated on the accepted fork
```

### The Big Picture

Regardless of the chain, the pipeline is always:

```
Transaction
   -> validation
   -> candidate ordering
   -> consensus selection
   -> block acceptance/finality
   -> state transition
```

Consensus is the stage that turns "many possible next histories" into
"the one history everyone follows."

---

## 10. Key Takeaways

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Consensus   -> How many distributed nodes agree on one       │
│                 canonical history and one current state.      │
│                                                               │
│  PoW         -> Uses computational work as Sybil resistance.  │
│                 Secure, open, expensive, probabilistic final. │
│                                                               │
│  PoS         -> Uses economic stake as Sybil resistance.      │
│                 Efficient, flexible, more design complexity.  │
│                                                               │
│  DPoS        -> Stakeholders elect a smaller validator set.   │
│                 Faster, but more politically centralized.     │
│                                                               │
│  BFT         -> Supermajority voting under Byzantine faults.  │
│                 Strong safety and deterministic finality.     │
│                                                               │
│  Tendermint  -> PoS validator set + BFT rounds               │
│  /CometBFT      (propose, prevote, precommit, commit).        │
│                 Final once committed.                         │
│                                                               │
│  Solana      -> PoH is the clock/order anchor.               │
│                 Tower BFT is the voting system.               │
│                 PoH is NOT consensus by itself.               │
│                                                               │
│  Core idea   -> Consensus chooses the shared history.         │
│                 The state machine then applies it.            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quiz

Answer without scrolling up:

1. What is the difference between validation and consensus?
2. What are the 5 properties a good blockchain consensus system should have?
3. In PoW, what exactly is the miner trying to find, and why is it hard to produce but easy to verify?
4. Why is PoW considered Sybil resistant?
5. Why is PoS called economic security? What role does slashing play?
6. What is the difference between PoS and DPoS?
7. In BFT systems, why do we care about `3f + 1` validators and a `2/3` threshold?
8. What are the four main stages of Tendermint / CometBFT consensus?
9. Why is "Proof of History is Solana's consensus" an incorrect statement?
10. Give one major tradeoff each for PoW, Tendermint-style BFT, and Solana's design.

---

## Next

-> **Milestone 1.4: Networking** - P2P networks, gossip protocol, node types (full, light, archive, validator)
