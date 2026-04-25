# Milestone 1.7: DeFi Primitives — AMMs, Lending, Oracles, Bridges, Liquid Staking, MEV

---

## Why This Comes Next

You now understand the full technical stack:
- cryptography, blocks, consensus, networking, accounts, architecture

Now we zoom out and ask:

**What do people actually BUILD with all of this?**

DeFi (Decentralized Finance) is the answer. It's the set of financial
primitives that replace banks, exchanges, and financial institutions
using smart contracts instead of trusted intermediaries.

This milestone is conceptual. You're learning WHAT these things are
and HOW they work under the hood — not yet how to build them.
That comes in later phases.

---

## 1. AMM — Automated Market Maker

### The Problem: How Do You Trade Without an Order Book?

Traditional exchange (like NYSE or Binance):

```
Buyer places order:  "I want to buy 1 ETH at $3000"
Seller places order: "I want to sell 1 ETH at $3000"
Exchange matches them → trade happens

This is an ORDER BOOK model.
Requires:
  - Buyers and sellers online at the same time
  - Market makers to provide liquidity
  - A central entity to run the order book
```

On a blockchain, order books are impractical:

```
Every order placement = 1 transaction = gas fee
Every order cancellation = 1 transaction = gas fee
Every order update = 1 transaction = gas fee

Active trading → thousands of gas payments
During volatility → orders flood the chain → congestion

Plus: who runs the matching engine? A centralized entity = not DeFi.
```

### The AMM Solution

AMMs replace order books with a **liquidity pool** and a **mathematical formula**.

```
Instead of matching buyers and sellers:
  A POOL holds two tokens.
  You trade AGAINST the pool.
  A formula automatically sets the price.

No order book. No matching engine. No counterparty needed.
Just math and a smart contract.
```

### The Constant Product Formula — x * y = k

Uniswap (the most famous AMM) uses:

```
x * y = k

Where:
  x = amount of Token A in the pool
  y = amount of Token B in the pool
  k = constant (never changes)

Example pool:
  ETH: 100
  USDC: 300,000
  k = 100 × 300,000 = 30,000,000

  Current price = 300,000 / 100 = $3,000 per ETH
```

### How a Swap Works

Alice wants to buy 1 ETH with USDC:

```
Before swap:
  Pool: 100 ETH, 300,000 USDC, k = 30,000,000

Alice adds USDC to the pool and takes ETH out.

The formula must hold: x * y = k

  New ETH in pool = x'
  New USDC in pool = y'

  We know:
    x' = 100 - 1 = 99 ETH  (Alice taking 1 ETH out)
    x' * y' = 30,000,000
    99 * y' = 30,000,000
    y' = 30,000,000 / 99 = 303,030.30 USDC

  Alice must PUT IN:
    303,030.30 - 300,000 = 3,030.30 USDC

  Alice paid $3,030.30 for 1 ETH.
  (Market was $3,000 but she paid more — this is PRICE IMPACT)
```

### Price Impact and Slippage

```
The more you buy, the more expensive it gets.
The formula curves the price automatically.

Small trade (0.01 ETH):  ≈ $3,000 (barely any impact)
Medium trade (1 ETH):    ≈ $3,030 (1% price impact)
Large trade (10 ETH):    ≈ $3,333 (11% price impact)
Huge trade (50 ETH):     ≈ $6,000 (100% price impact)

This is called PRICE IMPACT or SLIPPAGE.
The pool "resists" large trades by making them more expensive.

SLIPPAGE = difference between expected price and actual price
           You set a max slippage (e.g. 0.5%) when trading
           If slippage exceeds it → tx reverts (protects you from bad prices)
```

### Liquidity Providers — Who Fills the Pool?

```
Anyone can deposit tokens into the pool and become a
LIQUIDITY PROVIDER (LP).

Alice deposits:
  1 ETH + 3,000 USDC → into the ETH/USDC pool
  She gets "LP tokens" representing her share of the pool.

In return, Alice earns:
  A portion of every trading fee (0.3% on Uniswap v2)
  collected from every swap through this pool.

When Alice wants to exit:
  She burns her LP tokens
  Gets back her share of the pool (ETH + USDC)
  Plus accumulated fees
```

### Impermanent Loss — The Hidden Risk of Being an LP

```
This is one of the most important DeFi concepts.

Scenario:
  Alice deposits: 1 ETH ($3,000) + 3,000 USDC = $6,000 total

  ETH price rises to $4,000.

  Arbitrageurs buy ETH from the pool until the pool price = $4,000.
  Pool rebalances:
    Before: 100 ETH, 300,000 USDC
    After:  86.6 ETH, 346,410 USDC  (k = 30,000,000 preserved)

  Alice's 1% share:
    0.866 ETH + 3,464 USDC = $3,464 + $3,464 = $6,928

  If Alice had just HELD:
    1 ETH ($4,000) + 3,000 USDC = $7,000

  Loss from providing liquidity vs holding: $7,000 - $6,928 = $72
  That's Impermanent Loss.

Why "impermanent"?
  If ETH returns to $3,000 → loss disappears.
  But if Alice withdraws while ETH is at $4,000 → loss realized.

Impermanent loss is worse when:
  - Price moves a LOT in one direction
  - Assets in the pool are highly correlated in volatility

LPs profit when:
  - Trading fees earned > impermanent loss
  - Price stays relatively stable
```

### AMM Variants

```
Uniswap v2 (constant product x*y=k):
  Simple. Works for any token pair.
  High slippage for large trades.

Uniswap v3 (concentrated liquidity):
  LPs choose a price RANGE to provide liquidity.
  Capital efficiency is much higher.
  More complex for LPs to manage.

Curve Finance (stable pools):
  Optimized for stablecoins (USDC/USDT/DAI).
  Uses a different formula (StableSwap) that keeps
  price stable near 1:1 with very low slippage.
  Near-zero price impact for stablecoin swaps.

Balancer (weighted pools):
  Pools can have more than 2 tokens.
  Weights don't need to be 50/50.
  e.g. 80% ETH / 20% USDC pool.
```

---

## 2. Lending and Borrowing

### The Problem

Traditional lending requires:
- Credit checks (KYC)
- Bank as intermediary
- Trust in the borrower

DeFi lending uses **collateral** instead of trust.

### How DeFi Lending Works — Overcollateralization

```
Bob wants to borrow 1,000 USDC.
He doesn't want to sell his ETH.

Step 1: Bob deposits 0.5 ETH ($1,500) as collateral into Aave.
Step 2: Bob borrows 1,000 USDC (up to 80% of collateral value).
Step 3: Bob pays interest on the 1,000 USDC over time.
Step 4: When Bob repays 1,000 USDC + interest → gets his ETH back.

Why overcollateralize? (deposit $1,500 to borrow $1,000)
  No credit checks. No identity. Smart contract can't sue you.
  The collateral IS the guarantee.
  If Bob disappears, the collateral covers the debt.
```

### Liquidation — What Happens When Collateral Drops

```
Bob deposits:  0.5 ETH ($1,500) → borrows $1,000 USDC
LTV (Loan to Value) ratio = 1000/1500 = 66.7%

ETH price drops from $3,000 to $2,000.
Bob's collateral is now worth $1,000.
LTV = 1000/1000 = 100% → THIS IS DANGEROUS.

Liquidation threshold (e.g. 80%):
  If LTV > 80% → the position can be liquidated.

Liquidators (bots or humans):
  Repay Bob's debt (1,000 USDC).
  Receive Bob's collateral at a discount (e.g. 5% bonus).
    → Get $1,000 + 5% = $1,050 worth of ETH for paying $1,000.

Bob loses his ETH. Debt is cleared. Protocol is protected.

Lesson: DeFi borrowers must watch their collateral ratio
        or they get liquidated automatically by the protocol.
```

### Interest Rates — Supply and Demand

```
Interest rates in DeFi adjust algorithmically based on
how much of the pool is being borrowed (utilization rate).

Utilization = borrowed / deposited

Utilization 10%:  → low demand → low interest rate (1%)
Utilization 50%:  → moderate → moderate rate (5%)
Utilization 90%:  → high demand → high interest rate (20%)
Utilization 99%:  → near full → extremely high rate (100%+)

Why go to 100%?
  Forces borrowers to repay (too expensive to hold)
  Incentivizes new depositors to add supply (earning 100%+)
  Keeps the market balanced automatically.

No human sets these rates.
A formula (utilization curve) does it automatically.
```

### Flash Loans — Uncollateralized Borrowing

```
This exists ONLY in DeFi. Impossible in traditional finance.

A flash loan lets you borrow ANY amount with ZERO collateral
as long as you repay it in THE SAME TRANSACTION.

How?
  Everything in one tx: borrow → use → repay
  If repay fails → entire tx reverts → lender has zero risk.
  Lender never actually "loses" the funds even for a moment.

Example:
  1. Borrow 1,000,000 USDC from Aave (no collateral)
  2. Buy ETH on Uniswap at $3,000
  3. Sell ETH on SushiSwap at $3,010 (price difference)
  4. Repay 1,000,000 USDC + 0.09% fee to Aave
  5. Profit: $10,000 - fees

  If step 4 fails → entire tx reverts → Aave keeps its USDC.
  Risk to Aave: zero. Risk to borrower: just the gas fee.

Flash loans are used for:
  ✓ Arbitrage (as above)
  ✓ Liquidations (borrow to liquidate a position, profit the bonus)
  ✓ Collateral swapping (change your collateral type in one tx)
  ✗ Attacks (many DeFi hacks use flash loans to manipulate prices)
```

### Major Lending Protocols

```
Aave:      largest lending protocol. Flash loans. Multiple collateral types.
Compound:  pioneered algorithmic interest rates. Simple interface.
MakerDAO:  borrow DAI (stablecoin) against ETH collateral.
           DAI is a decentralized stablecoin backed by crypto collateral.
```

---

## 3. Oracles — Bringing Real World Data On-Chain

### The Problem

Smart contracts are deterministic and sandboxed.
They can only access data that's already on the blockchain.

```
A contract cannot:
  - Call an API
  - Access the internet
  - Read a stock price
  - Know today's weather

But DeFi needs real-world data:
  - What is the current ETH/USD price? (for liquidations)
  - What is the BTC price? (for derivatives)
  - Did this sports team win? (for prediction markets)
  - What is the interest rate? (for lending)
```

An **oracle** is a service that brings off-chain data on-chain.

### How Chainlink Works (Most Used Oracle)

```
Chainlink is a decentralized oracle network.

Step 1: Data providers (independent nodes) fetch prices
        from many sources (Binance, Coinbase, Kraken, etc.)

Step 2: Each Chainlink node reports the price it sees.

Step 3: Prices are aggregated (median of all reports).
        Outliers are ignored.

Step 4: Final aggregated price is published on-chain.
        Any smart contract can read it.

Step 5: Chainlink nodes are paid in LINK token for their service.
        They stake LINK as collateral → slashed if they report bad data.

Price update: every ~1 hour OR when price moves >0.5%
              (whichever comes first)
```

### Why Decentralized Oracles Matter

```
Centralized oracle (one source):
  If that source is hacked, manipulated, or goes down
  → smart contracts get wrong data
  → wrong liquidations, wrong prices, protocol breaks

Decentralized oracle (many sources):
  Attacker must corrupt MAJORITY of independent nodes
  simultaneously to manipulate the price
  → Much harder. Much more expensive.

This is why Chainlink uses many independent data providers.
```

### Oracle Manipulation — A Real Attack Vector

```
Many DeFi hacks involve oracle manipulation.

Example attack (simplified):
  Protocol uses an AMM pool price as its oracle.
  Attacker takes a flash loan of $100M.
  Manipulates the AMM price temporarily.
  Protocol reads the manipulated price.
  Attacker extracts value based on wrong price.
  Repays flash loan in same tx.
  Profit.

Defense: use TIME-WEIGHTED AVERAGE PRICE (TWAP)
  Instead of spot price, use average price over last 30 minutes.
  Flash loan lasts one transaction (~seconds).
  TWAP over 30 minutes can't be manipulated in one tx.
  → Attack becomes too expensive.
```

### Other Oracle Use Cases

```
Price feeds:        ETH/USD, BTC/USD (most common)
Randomness:         Chainlink VRF (verifiable random function)
                    Used for NFT mints, gaming, lotteries
                    Provably random AND verifiable on-chain
Cross-chain data:   What happened on another blockchain?
Real-world events:  Sports results, election outcomes (prediction markets)
Weather data:       Crop insurance smart contracts
```

---

## 4. Bridges — Moving Assets Across Chains

### The Problem

```
Alice has ETH on Ethereum mainnet.
She wants to use it on Arbitrum (a separate chain).

These are different blockchains.
ETH on Ethereum ≠ ETH on Arbitrum.
You can't just "send" it — there's no shared ledger.
```

A **bridge** lets you move assets between chains.

### How Bridges Work — Lock and Mint

```
The most common pattern:

Step 1: Alice sends 1 ETH to a Bridge Contract on Ethereum.
        Bridge locks her ETH.

Step 2: Bridge relayers detect the lock on Ethereum.
        They send a message to Arbitrum.

Step 3: Bridge Contract on Arbitrum mints 1 "WETH" (wrapped ETH).
        Sends it to Alice's address on Arbitrum.

Now Alice has 1 WETH on Arbitrum backed by 1 real ETH locked on Ethereum.

To go back:
Step 4: Alice burns 1 WETH on Arbitrum.
Step 5: Bridge unlocks 1 ETH on Ethereum → sends to Alice.
```

```
Visualized:

Ethereum:   Alice → [Bridge Contract] → 1 ETH LOCKED
                              │
                              │ relayer detects, sends message
                              ▼
Arbitrum:   [Bridge Contract] → mints 1 WETH → Alice
```

### Bridge Security — The Weakest Link in DeFi

```
Bridges are the most hacked targets in DeFi.

Why?
  Bridges hold HUGE amounts of locked assets.
  If someone can trick the bridge into minting without locking:
  → infinite free tokens on the destination chain
  → drain the locked funds on source chain

Biggest bridge hacks:
  Ronin Bridge (Axie Infinity):  $625M stolen (2022)
  Wormhole:                      $320M stolen (2022)
  Nomad Bridge:                  $190M stolen (2022)
  Harmony Horizon:               $100M stolen (2022)

Combined: over $1 billion in bridge hacks in 2022 alone.
```

### Types of Bridges

```
Trusted / Centralized bridge:
  A company holds your funds and issues IOUs.
  Fast. Simple. Trusts the company.
  Risk: company gets hacked or goes rogue.
  Examples: early WBTC, many CEX bridges

Multisig bridge:
  A group of signers (e.g. 5 of 9) must approve transfers.
  Better than 1 entity. Still centralized if signers collude.
  Ronin was this type — attacker got 5/9 keys.

Light client bridge:
  Destination chain actually verifies source chain's consensus.
  Uses cryptographic proofs (not trust).
  Most secure but hardest to build.
  IBC (Cosmos) uses this model.

Optimistic bridge:
  Like optimistic rollups — assumes honest behavior.
  7-day delay to challenge fraudulent transfers.
  Secure but slow.
  Optimism's native bridge works this way.

ZK bridge:
  Uses zero-knowledge proofs to verify cross-chain state.
  Fast and trustless. Still being developed.
  Most promising long-term solution.
```

---

## 5. Liquid Staking

### The Problem With Regular Staking

```
Ethereum PoS requires validators to stake 32 ETH.

Problems:
  1. 32 ETH minimum is expensive (~$80,000+)
     → most people can't afford to validate directly

  2. Staked ETH is LOCKED (illiquid)
     → can't use it in DeFi while staking
     → opportunity cost: missing out on yields elsewhere
```

### What Liquid Staking Does

```
Liquid staking protocols allow you to:
  1. Stake any amount (even 0.01 ETH)
  2. Receive a LIQUID TOKEN representing your stake
  3. Use that liquid token in DeFi while still earning staking rewards

Example with Lido (largest liquid staking protocol):

  Alice deposits 1 ETH into Lido
  Lido gives her 1 stETH (staked ETH)

  stETH represents: "1 ETH staked, currently earning 4% APY"

  stETH balance increases daily as staking rewards accumulate:
    Day 1:  1.000 stETH
    Day 30: 1.003 stETH (accumulated rewards)
    Day 365: 1.04 stETH (full year of staking)

  Meanwhile, Alice can use stETH in DeFi:
    → Supply stETH to Aave as collateral → borrow more ETH
    → Provide stETH/ETH liquidity on Curve → earn trading fees too
    → Stack multiple yields simultaneously
```

### How Lido Works Under the Hood

```
Lido pools ETH from many users.
Lido runs professional validators with pooled ETH.

  Alice deposits 1 ETH   ┐
  Bob deposits 10 ETH    ├──► Lido pools all ETH
  Charlie deposits 5 ETH ┘    Runs validators with 32 ETH chunks

  Staking rewards distributed proportionally to stETH holders.
  Lido takes 10% cut of rewards.

Anyone can unstake:
  Burn stETH → request ETH back → takes days (withdrawal queue)
  OR: swap stETH → ETH on Curve instantly (at a slight discount)
```

### Liquid Staking Risks

```
Smart contract risk:
  Lido smart contracts hold billions of dollars.
  A bug could drain everything.

Centralization risk:
  Lido controls ~32% of all staked ETH (2024).
  If Lido validators go offline → could affect Ethereum security.
  Ethereum community debated whether Lido is too dominant.

Depeg risk:
  stETH should always be worth ~1 ETH.
  But if market panics, stETH can trade at a discount.
  During Terra/Luna collapse (2022): stETH briefly hit 0.94 ETH.

Slashing risk:
  Lido validators can get slashed.
  Losses distributed to all stETH holders proportionally.
```

### Other Liquid Staking Tokens

```
Protocol    Token    Network
────────────────────────────────
Lido        stETH    Ethereum (largest)
Rocket Pool rETH     Ethereum (decentralized)
Frax        frxETH   Ethereum
Marinade    mSOL     Solana
Lido        stSOL    Solana
Stride      stATOM   Cosmos
```

---

## 6. MEV — Maximal Extractable Value

### What is MEV?

MEV = the extra profit a block producer (miner/validator) can extract
by controlling the ORDER of transactions in a block.

```
You thought transactions just get ordered by fee.
Reality: the proposer has FULL CONTROL over:
  - which transactions to include
  - which order to put them in
  - which transactions to exclude

This power can be monetized.
That monetization is MEV.
```

### Type 1: Arbitrage

```
DEX prices get out of sync.
  Uniswap ETH/USDC price: $3,000
  SushiSwap ETH/USDC price: $3,010

A searcher (MEV bot) spots this.
Submits a tx: buy ETH on Uniswap, sell on SushiSwap.
Profit: $10 per ETH minus gas.

This is GOOD MEV — it aligns prices across DEXes.
```

### Type 2: Sandwich Attack

```
Alice submits a tx: "buy 100 ETH on Uniswap, max 1% slippage"

A searcher (MEV bot) sees Alice's pending tx in the mempool.

Bot FRONT-RUNS Alice:
  1. Bot buys ETH BEFORE Alice → price goes up
  2. Alice's tx executes → buys at higher price (within her 1% slippage)
  3. Bot BACK-RUNS Alice → sells ETH right after → price goes back down

Bot profits the price difference.
Alice gets a worse price (pays more than she should).

This is called a SANDWICH ATTACK.
Alice is "sandwiched" between the bot's two transactions.

The bot bribes the validator with a high tip to order txs correctly.
```

### Type 3: Liquidation MEV

```
A lending position becomes eligible for liquidation.

Multiple bots race to liquidate first (to earn the bonus).
They all submit txs with high gas fees.
Winner gets the liquidation reward.
```

### Type 4: Time-Bandit Attacks (theoretical)

```
A validator sees a block full of MEV (say $10M profit).
The block reward is only $1M.

Temptation: reorg the chain (reorganize recent blocks)
to STEAL that MEV from someone else who already captured it.

In Bitcoin: would require 51% attack.
In Ethereum: post-Merge, would require slashing risk + 1/3 stake.
Generally not profitable. But theoretically possible.
```

### The MEV Supply Chain

```
MEV created a whole ecosystem:

SEARCHERS:
  Independent bots that look for MEV opportunities.
  Write complex algorithms to spot arbitrage, sandwiches, liquidations.
  Pay high tips to validators to get their txs included first.

BUILDERS:
  Specialized actors who build the most profitable blocks.
  They receive txs from searchers + regular users.
  Construct the optimal tx ordering to maximize MEV + fees.
  Then offer these blocks to validators.

VALIDATORS/PROPOSERS:
  Pick the most profitable block offered by builders.
  Earn the fees + MEV share.
  Don't need to do the hard work of searching for MEV themselves.

This is called PBS: Proposer-Builder Separation.
```

### MEV-Boost (Ethereum)

```
Ethereum validators use MEV-Boost middleware:

  Validator doesn't build blocks itself.
  Instead, it asks a RELAY: "what's the best block you have?"
  Multiple builders compete → relay selects highest paying.
  Validator signs and proposes that block.
  Validator earns the block reward + builder's payment.

Result:
  ~90% of Ethereum blocks are built using MEV-Boost.
  Validators earn 2-4x more than they would without MEV.
  Searchers extract value from users (neutral to bad).
  Block building is increasingly centralized in a few builders.
```

### MEV Impact on Users

```
Bad MEV (harmful to users):
  ✗ Sandwich attacks → worse prices
  ✗ Front-running → you pay more than you should
  ✗ Increased gas prices (bots bidding up fees)

Good MEV (beneficial to ecosystem):
  ✓ Arbitrage → price alignment across DEXes
  ✓ Liquidations → lending protocols stay solvent
  ✓ Validator revenue → more economic incentive to validate

MEV is estimated to have extracted billions of dollars from
Ethereum users since DeFi became popular (2020 onwards).
```

### Protecting Against MEV

```
Private mempools:
  Send your tx directly to a builder → not visible to searchers.
  Flashbots Protect: free service that routes txs privately.

Slippage tolerance:
  Set tight slippage (0.1%) → sandwich not profitable.
  But your tx might fail if price moves.

Time-Weighted AMMs:
  AMM designs that make sandwiching harder.

MEV-aware DEX design:
  CoW Protocol (Coincidence of Wants):
    Matches users directly against each other when possible.
    Remaining orders go to AMMs.
    Much harder to sandwich batch orders.
```

---

## 7. Putting DeFi Together — A Complex Flow

Alice wants to maximize yield on her ETH:

```
Step 1: Liquid stake
  Deposit 10 ETH into Lido
  Receive 10 stETH
  Earning: ~4% staking APY automatically

Step 2: Use stETH as collateral
  Deposit 10 stETH into Aave
  Borrow 5,000 USDC (50% LTV, safe from liquidation)

Step 3: Provide liquidity
  Use 2,500 USDC + some ETH → provide to Uniswap ETH/USDC pool
  Earn: ~0.3% of every swap through that pool

Step 4: Farm with LP tokens
  Some protocols give extra token rewards for holding LP tokens
  (called "yield farming" or "liquidity mining")

Result:
  Alice is simultaneously earning:
    - Ethereum staking rewards (via stETH)
    - Aave lending fees from her stETH collateral
    - Uniswap trading fees
    - Farming rewards

  This "stacking" of yields is what makes DeFi unique.
  Traditional finance can't do this.
  In TradFi, your collateral is locked and earns nothing.
  In DeFi, everything can earn simultaneously.

  Risk: all these protocols could be hacked.
        A bug in Aave, Lido, or Uniswap = potential loss.
        Never invest more than you can afford to lose.
```

---

## Key Takeaways

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  AMM           → Liquidity pools + math formula replace      │
│                  order books. x*y=k. LPs earn fees but       │
│                  risk impermanent loss.                       │
│                                                               │
│  Lending       → Overcollateralized borrowing. Collateral     │
│                  dropped too far → liquidation. Flash loans:  │
│                  borrow anything, repay in same tx.           │
│                                                               │
│  Oracles       → Bring real-world data on-chain.             │
│                  Chainlink: decentralized, aggregated.        │
│                  Oracle manipulation = major attack vector.   │
│                                                               │
│  Bridges       → Lock on source, mint on destination.        │
│                  Most hacked targets in DeFi.                 │
│                  IBC and ZK bridges = most trustless.         │
│                                                               │
│  Liquid Staking → Stake any amount, get liquid token.        │
│                   Use stETH in DeFi while earning rewards.    │
│                                                               │
│  MEV           → Value extracted by controlling tx order.    │
│                  Sandwich attacks hurt users.                 │
│                  Arbitrage helps ecosystem.                   │
│                  MEV-Boost: validators outsource block        │
│                  building to specialized builders.            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quiz

1. What is the constant product formula? What is k and why does it never change?
2. Alice swaps a large amount in an AMM pool. Why does she get a worse price than the current market price?
3. What is impermanent loss? When does it become permanent?
4. What is overcollateralization and why is it required in DeFi lending?
5. Explain what a flash loan is. Why does the lender have zero risk?
6. What is an oracle? Why can't a smart contract just call an API directly?
7. How does Chainlink prevent a single bad data source from corrupting the price feed?
8. What is the lock-and-mint pattern in bridges? What makes bridges risky?
9. What is liquid staking? What problem does stETH solve?
10. What is MEV? Give one example of harmful MEV and one example of beneficial MEV.
11. What is a sandwich attack? Walk through it step by step.
12. What is PBS (Proposer-Builder Separation) and why did it emerge?

---

## Next

→ **Milestone 1.8: Security** — common attack vectors, reentrancy, flash loan attacks,
  oracle manipulation, smart contract auditing basics
