# Milestone 1.8: Security — Attack Vectors, Reentrancy, Flash Loans, Oracle Manipulation, Auditing

---

## Why This Comes Last in Phase 1

You now understand:
- how blockchains work (1.1 - 1.6)
- what gets built on them (1.7)

Security is last because you need to understand the system
before you can understand how it breaks.

This milestone matters because:

```
In traditional software:
  A bug → patch it → users download the update → problem solved.

In blockchain:
  A bug → exploited → funds drained → CANNOT be reversed.
  Smart contracts are immutable.
  There is no "patch and push."
  
  The DAO hack (2016): $60M drained. Required a hard fork to fix.
  Ronin bridge (2022): $625M stolen. Never recovered.
  Nomad bridge (2022): $190M drained in hours.

Code is law. Bugs are permanent.
This is why security is critical before writing a single line.
```

---

## 1. How Smart Contract Attacks Work — The Mental Model

Before specific attacks, understand the general pattern:

```
Smart contract security fails in 3 broad ways:

1. LOGIC BUGS:
   The code does exactly what it says, but what it says is wrong.
   Developer assumed X, but Y is also possible.

2. INTERACTION BUGS:
   Contract A is safe alone. Contract B is safe alone.
   But A calling B (or B calling A) creates unexpected behavior.
   Most famous: reentrancy.

3. ASSUMPTION BUGS:
   Contract trusts external data (price feeds, timestamps, other contracts)
   that can be manipulated.
   Most famous: oracle manipulation, flash loan attacks.
```

---

## 2. Reentrancy — The Most Famous Smart Contract Bug

### What is Reentrancy?

Reentrancy happens when a contract calls an external contract,
and that external contract calls BACK into the first contract
BEFORE the first contract has finished updating its state.

```
Victim contract has two steps:
  Step 1: Send ETH to user
  Step 2: Update user's balance to 0

Attacker exploits the GAP between step 1 and step 2.
```

### The DAO Hack (2016) — Real World Example

The DAO was a smart contract holding ~$150M.
It had a withdrawal function:

```solidity
// VULNERABLE CODE (simplified)
function withdraw() public {
    uint amount = balances[msg.sender];
    
    // Step 1: Send ETH to caller
    msg.sender.call{value: amount}("");
    
    // Step 2: Update balance (TOO LATE!)
    balances[msg.sender] = 0;
}
```

The attacker deployed a malicious contract:

```solidity
// ATTACKER CONTRACT
contract Attacker {
    Victim victim;

    function attack() public {
        victim.withdraw();  // first call
    }

    // This runs when Victim sends ETH
    receive() external payable {
        if (address(victim).balance > 0) {
            victim.withdraw();  // CALL AGAIN before balance is zeroed!
        }
    }
}
```

### Step by Step Attack

```
1. Attacker deposits 1 ETH into The DAO.
   balances[attacker] = 1 ETH

2. Attacker calls withdraw().

3. DAO executes Step 1: sends 1 ETH to attacker contract.

4. Attacker contract's receive() function triggers automatically.
   BEFORE Step 2 runs (balance still shows 1 ETH).

5. receive() calls withdraw() AGAIN.
   DAO checks: balances[attacker] = 1 ETH → still 1! → sends 1 more ETH.

6. receive() triggers AGAIN → calls withdraw() AGAIN.
   DAO checks: balances[attacker] = 1 ETH → still 1! → sends 1 more ETH.

7. Loop continues until DAO is drained.

8. FINALLY Step 2 runs: balances[attacker] = 0.
   But by then 1 ETH became 1000 ETH extracted.

Timeline:
  Deposit 1 ETH → drain entire contract → balance zeroed
  All in one transaction.
```

### How to Fix Reentrancy — 3 Patterns

**Pattern 1: Checks-Effects-Interactions (CEI)**

```solidity
// SAFE CODE — CEI pattern
function withdraw() public {
    uint amount = balances[msg.sender];
    
    // CHECK: validate state
    require(amount > 0, "nothing to withdraw");
    
    // EFFECT: update state FIRST
    balances[msg.sender] = 0;          // zero the balance BEFORE sending
    
    // INTERACTION: external call LAST
    msg.sender.call{value: amount}(""); // now reentrancy is useless
                                        // balance is already 0
}
```

If attacker reenters now:
```
1. withdraw() called → amount = 1 ETH
2. balances[attacker] = 0  ← FIRST
3. Send 1 ETH to attacker
4. receive() triggers → calls withdraw() again
5. amount = balances[attacker] = 0 → nothing to withdraw → reverts
```

**Pattern 2: Reentrancy Guard (Mutex)**

```solidity
// Add a lock variable
bool private locked;

modifier noReentrant() {
    require(!locked, "no reentrant");
    locked = true;
    _;
    locked = false;
}

function withdraw() public noReentrant {
    uint amount = balances[msg.sender];
    balances[msg.sender] = 0;
    msg.sender.call{value: amount}("");
}
```

If attacker reenters:
```
First call:   locked = true
Reentrant call: require(!locked) → REVERTS immediately
```

OpenZeppelin's ReentrancyGuard implements this pattern.
Most DeFi protocols use it.

**Pattern 3: Pull over Push**

```
Instead of PUSHING ETH to users (contract sends):
  → PULL model: users CLAIM their ETH themselves.

Attacker can't trigger receive() if they have to
explicitly call a separate claim function.
Still use CEI inside the claim function.
```

### Cross-Function Reentrancy

More subtle. Two functions share state:

```solidity
// Both functions use balances[]
function withdraw() public {
    uint amount = balances[msg.sender];
    msg.sender.call{value: amount}("");  // attacker reenters transfer()
    balances[msg.sender] = 0;
}

function transfer(address to, uint amount) public {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    balances[to] += amount;
}
```

Attacker reenters transfer() during withdraw().
Balance not yet zeroed → can transfer AND withdraw.

Fix: use reentrancy guard on BOTH functions that share state.

### Cross-Contract Reentrancy

Protocol A calls Protocol B.
Protocol B calls back into Protocol A (different function).
Shared state is inconsistent.

This is why complex DeFi interactions are dangerous.
Composability ("money legos") = composable attack surface.

---

## 3. Integer Overflow and Underflow

### What is It?

Integers in Solidity have fixed sizes. When you exceed the limit,
the number wraps around.

```
uint8 stores: 0 to 255

uint8 x = 255;
x = x + 1;    // Overflows → x = 0 (wraps around)

uint8 y = 0;
y = y - 1;    // Underflows → y = 255 (wraps around)
```

### Real World: BEC Token Hack (2018)

```solidity
// VULNERABLE (Solidity < 0.8.0)
function batchTransfer(address[] receivers, uint256 value) public {
    uint cnt = receivers.length;
    uint256 amount = cnt * value;   // OVERFLOW HERE
    
    require(balances[msg.sender] >= amount);
    // ...
}
```

Attacker called with:
```
receivers = [addr1, addr2]  (cnt = 2)
value = 2^255               (huge number)

amount = 2 * 2^255 = 2^256 → OVERFLOWS → amount = 0

require(balances[msg.sender] >= 0) → always true!

Attacker transferred 2^255 tokens to each address.
Created tokens from nothing.
BEC token price crashed to near zero instantly.
```

### Fix

**Solidity >= 0.8.0:**
```
Overflow/underflow causes automatic REVERT.
No longer possible in modern Solidity by default.
```

**Older code:**
```
Use OpenZeppelin's SafeMath library:
  SafeMath.add(a, b)   → reverts on overflow
  SafeMath.sub(a, b)   → reverts on underflow
  SafeMath.mul(a, b)   → reverts on overflow
```

---

## 4. Flash Loan Attacks — Weaponizing Uncollateralized Loans

You learned flash loans in 1.7 as a DeFi tool.
Here's how they become weapons.

### How Flash Loans Enable Attacks

```
Flash loans give attackers:
  → Millions of dollars with zero capital
  → For one transaction
  → With zero risk if it fails

This turns "expensive to attack" into "cheap to attack."
Many attacks that required $10M+ of capital to execute
can now be done with $0 and a smart contract.
```

### The Beanstalk Attack (2022) — $182M

Beanstalk was a stablecoin protocol with on-chain governance.
To vote: hold BEAN tokens.

```
Attacker's plan:
  1. Flash loan $1 billion in USDC/DAI/USDT
  2. Buy huge amount of BEAN tokens → becomes majority voter
  3. Submit malicious governance proposal
  4. Vote YES with majority stake → proposal passes IMMEDIATELY
     (Beanstalk had no time delay on governance)
  5. Malicious proposal drains $182M from protocol treasury
  6. Sell BEAN tokens back
  7. Repay flash loan
  8. Keep $182M

All in ONE TRANSACTION.
```

Lesson:
```
Governance with flash loans is dangerous.
Fix: require tokens to be held for X blocks BEFORE voting.
     (Can't flash loan → buy → vote → repay in one tx
      if tokens must be held for 100 blocks first)
```

### Price Manipulation via Flash Loans

```
Protocol uses AMM spot price as oracle.

Attacker:
  1. Flash loan $10M USDC
  2. Swap all $10M for ETH on small AMM pool
     → ETH price in pool spikes to $9,000 (real price $3,000)
  3. Protocol reads oracle → thinks ETH = $9,000
  4. Attacker borrows against "inflated" ETH collateral
     → borrows $9M worth of tokens against ETH "worth $9,000"
     → actual ETH value $3,000
  5. Swap ETH back → price returns to $3,000
  6. Repay flash loan
  7. Walk away with $6M profit
  8. Protocol is left with bad debt

Fix: use TWAP oracle (time-weighted average price)
     Flash loan lasts ~1 tx. TWAP averages over 30 min.
     Can't manipulate 30-min average in 1 tx.
```

---

## 5. Oracle Manipulation (Expanded)

You learned oracles in 1.7. Here's the attack surface in detail.

### Spot Price Oracle Attack

```
Any protocol that uses a single AMM pool's spot price as
its price oracle is vulnerable.

The smaller the pool, the cheaper the attack.

Defense:
  1. Use Chainlink (decentralized, not manipulable in one tx)
  2. Use TWAP (time-weighted average price)
  3. Use multiple oracle sources, take median
  4. Add circuit breakers (if price moves >X% in one block, pause)
```

### TWAP — Why It Works

```
TWAP = average price over last N blocks/minutes

Attacker manipulates spot price in block B:
  Block B: ETH spot price = $9,000 (manipulated)

TWAP over last 30 minutes:
  Blocks B-150 to B-1: ETH price = $3,000
  Block B:              ETH price = $9,000
  TWAP = ($3,000 × 149 + $9,000 × 1) / 150 = $3,040

Barely moved. Attack failed.

Cost to maintain manipulation over 30 minutes:
  Attacker must hold the manipulated position for 30 min.
  Competing arbitrageurs are correcting the price constantly.
  Would cost millions. Attack becomes unprofitable.
```

### Timestamp Manipulation

```
block.timestamp in Solidity returns the current block timestamp.
Miners/validators can manipulate it slightly (~15 seconds).

Vulnerable code:
  uint random = uint(keccak256(abi.encode(block.timestamp))) % 100;
  → "random" number based on timestamp

Miner can choose to include the block at a slightly different time
to get a favorable "random" number.

Fix: use Chainlink VRF (Verifiable Random Function)
     Cryptographically provable randomness that nobody can manipulate.
```

---

## 6. Access Control Vulnerabilities

### Unprotected Admin Functions

```solidity
// VULNERABLE
function setOwner(address newOwner) public {
    owner = newOwner;  // anyone can call this!
}

// SAFE
function setOwner(address newOwner) public onlyOwner {
    owner = newOwner;  // only current owner can call
}
```

Real example — Parity Multisig (2017):

```
A library contract that many wallets depended on
had an unprotected initialization function.

Someone (possibly by accident) called initWallet() on the library.
Became the "owner" of the library contract.
Then called kill() → self-destructed the library.
$280M in ETH in wallets using this library became permanently frozen.
Not stolen — just frozen forever.
Nobody could access those funds.
```

### tx.origin vs msg.sender

```solidity
// VULNERABLE — uses tx.origin
function transfer(address to, uint amount) public {
    require(tx.origin == owner);  // WRONG
    // ...
}
```

```
tx.origin = the ORIGINAL signer of the transaction (always an EOA)
msg.sender = the IMMEDIATE caller (could be a contract)

Attack:
  Owner calls MaliciousContract.
  MaliciousContract calls Victim.transfer().
  
  In Victim:
    tx.origin = owner (original signer) → passes check!
    msg.sender = MaliciousContract

  Attacker can steal funds even though owner didn't intend to.

Fix: ALWAYS use msg.sender for authorization, never tx.origin.
```

---

## 7. Logic Bugs — Subtle but Common

### Rounding Errors

```solidity
// Integer division truncates (rounds down)
uint share = totalFunds / users.length;

// If totalFunds = 100, users = 3:
// share = 33 (not 33.33)
// 1 wei stuck in contract forever
```

In large protocols handling millions, rounding errors can accumulate
to significant amounts. Sometimes exploitable.

### Wrong Order of Operations

```solidity
// VULNERABLE
uint reward = userStake / totalStake * rewardPool;
// If userStake < totalStake: result = 0 (truncated to 0!)

// SAFE — multiply first, then divide
uint reward = userStake * rewardPool / totalStake;
```

### Missing Zero Address Check

```solidity
// VULNERABLE
function setFeeRecipient(address recipient) public onlyOwner {
    feeRecipient = recipient;  // could set to address(0)!
}

// Safe
function setFeeRecipient(address recipient) public onlyOwner {
    require(recipient != address(0), "zero address");
    feeRecipient = recipient;
}
```

If fees are sent to address(0) → burned forever. Protocol revenue lost.

---

## 8. Smart Contract Auditing

### What is an Audit?

An audit is a systematic security review of smart contract code
by security experts BEFORE deployment.

```
NOT: "We checked the code and it's fine."
IS:  A structured process of:
       - Manual code review line by line
       - Automated tool analysis
       - Attack scenario modeling
       - Formal verification (sometimes)
       - Written report of all findings
```

### The Audit Process

```
Step 1: SCOPING
  Define what's being audited.
  Which contracts? Which functions?
  What is the expected behavior?

Step 2: AUTOMATED ANALYSIS
  Run tools:
    Slither   → static analysis (finds common patterns)
    Mythril   → symbolic execution
    Echidna   → fuzzing (random inputs to find crashes)
  Tools find obvious issues fast but miss complex logic bugs.

Step 3: MANUAL REVIEW
  Auditors read every line.
  Check for:
    - Reentrancy
    - Access control
    - Integer overflow/underflow
    - Logic errors
    - Oracle dependencies
    - Flash loan attack surface
    - Gas optimizations (not security, but part of review)

Step 4: THREAT MODELING
  "What would an attacker try?"
  Auditors actively try to break the protocol.
  Write attack scenarios.

Step 5: REPORT
  All findings classified by severity:
    Critical: funds can be stolen
    High:     funds can be frozen or major loss
    Medium:   significant risk but harder to exploit
    Low:      minor issues, best practices
    Informational: no risk, just suggestions

Step 6: REMEDIATION
  Team fixes issues.
  Auditors verify fixes are correct.

Step 7: PUBLISH
  Report made public (transparency builds trust).
```

### Severity Classification Example

```
CRITICAL:
  Reentrancy that drains all funds.
  Anyone can call admin functions.
  Flash loan + oracle manipulation drains protocol.

HIGH:
  Liquidation can be blocked in certain conditions.
  Rounding error that accumulates over time.
  Missing access control on important function.

MEDIUM:
  Centralization risk (owner can rug).
  Missing events for important state changes.
  Incorrect calculation in edge case.

LOW:
  Using transfer() instead of call() for ETH.
  Unnecessary gas waste.
  Minor documentation issues.

INFORMATIONAL:
  Code style suggestions.
  Redundant code.
  Best practice recommendations.
```

### Who Audits?

```
Top audit firms:
  Trail of Bits    → most technical, deep formal methods
  OpenZeppelin     → largest, audited most major protocols
  Consensys Diligence → Ethereum-focused
  Spearbit         → newer, high-end researchers
  Sherlock / Code4rena / Immunefi → competitive audit platforms

Competitive audits (Code4rena, Sherlock):
  Protocol pays a prize pool (e.g. $100,000).
  Hundreds of independent auditors compete to find bugs.
  Each valid finding earns a share of the prize pool.
  Finds more bugs than a single firm (more eyes).
```

### Bug Bounties

After deployment, protocols offer ongoing rewards for finding bugs:

```
Immunefi platform:

  Protocol: "Find a critical bug → earn $1,000,000"
  White hat hacker: finds bug → reports responsibly
  Protocol: verifies bug → pays bounty → patches

Largest bug bounties ever paid:
  LayerZero:  $15,000,000
  MakerDAO:   $10,000,000
  Wormhole:   $10,000,000
  Optimism:   $2,000,042 (exact amount intentional)

Better for everyone:
  Hacker earns millions legally.
  Protocol saves billions in potential hack losses.
  Users are protected.
```

### Audit Limitations — What Audits Cannot Guarantee

```
An audit is NOT a guarantee of security.

  Auditors are human → can miss things.
  New attack vectors emerge after audit.
  Protocol adds new code after audit → new attack surface.
  Economic attacks (oracle manipulation, governance) are hard to audit.

Famous audited protocols that still got hacked:
  Euler Finance: audited by 10 firms. Hacked for $197M. (2023)
  Nomad Bridge:  audited. Hacked for $190M. (2022)
  Compound:      multiple audits. Had governance bug exploit. (2021)

An audit reduces risk. It does not eliminate risk.
Never invest more than you can afford to lose, even in audited protocols.
```

### Security Best Practices for Developers

```
Before writing code:
  ✓ Understand all external calls your contract makes
  ✓ Design with CEI (Checks-Effects-Interactions) from the start
  ✓ Minimize complexity — every line is attack surface

While writing code:
  ✓ Use OpenZeppelin contracts (battle-tested, audited)
  ✓ Use Solidity >= 0.8.0 (overflow protection built in)
  ✓ Add reentrancy guards to all state-changing functions
  ✓ Use Chainlink for price feeds, never AMM spot prices
  ✓ Never use tx.origin for authorization
  ✓ Check all return values from external calls
  ✓ Emit events for all important state changes

Testing:
  ✓ 100% line coverage minimum
  ✓ Fuzz testing (Foundry has built-in fuzzer)
  ✓ Fork mainnet tests (test against real deployed contracts)
  ✓ Invariant testing (properties that must always hold)

Before deployment:
  ✓ At least one professional audit
  ✓ Start with small TVL limits
  ✓ Add emergency pause functionality
  ✓ Timelocks on admin functions (24-48 hour delay on changes)
  ✓ Multisig for admin keys (no single point of failure)
  ✓ Bug bounty program from day one
```

---

## 9. Common Attack Reference

```
Attack              How it works                    Fix
────────────────────────────────────────────────────────────────
Reentrancy          Reenter before state update     CEI pattern, mutex
Integer overflow    Number wraps around             Solidity >=0.8.0
Flash loan          Borrow millions, manipulate,    TWAP oracles, time locks
                    repay in one tx                 on governance
Oracle manipulation Manipulate AMM spot price       Chainlink, TWAP
Access control      Anyone calls admin function     onlyOwner modifier
tx.origin           Phishing via intermediary       Use msg.sender
Sandwich attack     Front-run + back-run user swap  Private mempool, tight slippage
Front-running       See mempool, copy tx with       Private mempool, commit-reveal
                    higher gas
Governance attack   Flash loan votes on proposal    Time lock on governance
Timestamp manip     Miner adjusts block time        Chainlink VRF for randomness
Rounding error      Integer division truncates      Multiply before divide
Self-destruct       Forcefully send ETH to contract Never rely on address(this).balance
```

---

## Key Takeaways

```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Reentrancy    → External call before state update.          │
│                  Fix: CEI pattern or mutex.                   │
│                  Real: The DAO hack, $60M (2016).            │
│                                                               │
│  Flash loans   → $0 capital attacks. Atomic transaction.     │
│  as weapons      Fix: TWAP oracles, governance timelocks.    │
│                  Real: Beanstalk $182M (2022).               │
│                                                               │
│  Oracle manip  → Manipulate price in one block.              │
│                  Fix: Chainlink, TWAP.                        │
│                  Real: dozens of protocols drained.           │
│                                                               │
│  Access control→ Anyone calls protected function.            │
│                  Fix: onlyOwner, role-based access.           │
│                  Real: Parity $280M frozen (2017).           │
│                                                               │
│  Audits        → Reduce risk, don't eliminate it.            │
│                  Multiple audits + bug bounty = best practice.│
│                                                               │
│  Core rule     → In blockchain, bugs are permanent.          │
│                  Audit before deploy. Test everything.        │
│                  Never store more than you can afford to lose.│
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quiz

1. Why are smart contract bugs more serious than regular software bugs?
2. Explain reentrancy step by step. What is the gap that attackers exploit?
3. What is the CEI pattern? Why does it fix reentrancy?
4. What is integer overflow? Why is it less of a problem in modern Solidity?
5. How do flash loans enable attacks that would otherwise be impossible?
6. Walk through the Beanstalk governance attack. What was the missing protection?
7. What is a TWAP oracle and why does it resist flash loan manipulation?
8. What is the difference between tx.origin and msg.sender? Why is tx.origin dangerous?
9. What does an audit report's "Critical" severity mean vs "Medium"?
10. Why can an audited protocol still get hacked?
11. What is a bug bounty and why is it better for everyone than a hack?
12. Name 3 security best practices a developer should follow before deploying a contract.

---

## Phase 1 Complete

You have now completed all 8 milestones of Phase 1: Blockchain Foundations.

```
✓ 1.1 Cryptography       — Hashing, digital signatures, Merkle trees
✓ 1.2 Blockchain Core    — Blocks, chains, state machines, genesis, forks
✓ 1.3 Consensus          — PoW, PoS, DPoS, BFT, Tendermint, Solana PoH
✓ 1.4 Networking         — P2P, gossip protocol, node types
✓ 1.5 Accounts & Txs     — UTXO vs account model, nonce, gas, EIP-1559
✓ 1.6 Architecture       — EVM, Sealevel, Cosmos ABCI, modular vs monolithic
✓ 1.7 DeFi Primitives    — AMMs, lending, oracles, bridges, liquid staking, MEV
✓ 1.8 Security           — Reentrancy, flash loans, oracle manipulation, auditing
```

→ **Next: Phase 2 — Node.js + TypeScript**
  Start building real blockchain applications with code.
