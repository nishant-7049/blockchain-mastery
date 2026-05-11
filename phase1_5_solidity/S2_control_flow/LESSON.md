# S2 — Control Flow

> Covers: if/else, loops, require/revert/assert, custom errors

---

## 1. If / Else

Same syntax as JavaScript/TypeScript, with one important difference — no truthy/falsy.
In Solidity, conditions must be explicitly `bool`. `if (1)` or `if (address)` won't compile.

```solidity
function classify(uint256 x) public pure returns (string memory) {
    if (x == 0) {
        return "zero";
    } else if (x < 10) {
        return "small";
    } else {
        return "large";
    }
}
```

**Ternary operator** works too:
```solidity
string memory label = x > 0 ? "positive" : "zero or negative";
```

**No implicit conversion to bool:**
```solidity
uint256 x = 5;
if (x) { }          // ❌ won't compile
if (x != 0) { }     // ✅
if (x > 0) { }      // ✅
```

---

## 2. Loops

### for loop
```solidity
function sum(uint256[] memory nums) public pure returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < nums.length; i++) {
        total += nums[i];
    }
    return total;
}
```

### while loop
```solidity
uint256 i = 0;
while (i < 10) {
    i++;
}
```

### do-while loop
```solidity
uint256 i = 0;
do {
    i++;
} while (i < 10);
```

`break` exits the loop early. `continue` skips to the next iteration. Same as every other language.

---

## 3. The Gas Problem With Loops

This is where Solidity diverges from regular programming.

Every operation costs gas. Loops over unbounded arrays can run out of gas mid-execution and revert — **wasting the user's fee**.

```solidity
// DANGEROUS — if users[] grows to 10,000 entries, this will hit the block gas limit
function payAll() public {
    for (uint256 i = 0; i < users.length; i++) {
        payable(users[i]).transfer(1 ether);
    }
}
```

**Rules for loops in Solidity:**
1. Never loop over an array that users can grow unboundedly
2. Prefer mappings over arrays for lookups
3. If you must loop, set a hard cap on iterations

```solidity
// Safe — bounded loop
uint256 MAX = 100;
for (uint256 i = 0; i < users.length && i < MAX; i++) {
    ...
}
```

---

## 4. require / revert / assert

These are how Solidity handles validation and errors. They all **stop execution and revert all state changes** when triggered.

### `require`

Used for **input validation and conditions that depend on external factors** (user input, state).

```solidity
function withdraw(uint256 amount) public {
    require(amount > 0, "Amount must be positive");
    require(balances[msg.sender] >= amount, "Insufficient balance");
    balances[msg.sender] -= amount;
    payable(msg.sender).transfer(amount);
}
```

- If condition is `false` → revert with the message
- If condition is `true` → continue
- **Unused gas is refunded to the caller**

### `revert`

Used for **complex conditions** where `require` would be hard to read, or inside `if` blocks.

```solidity
function transfer(address to, uint256 amount) public {
    if (to == address(0)) {
        revert("Cannot transfer to zero address");
    }
    if (balances[msg.sender] < amount) {
        revert("Insufficient balance");
    }
    // ... rest of logic
}
```

`require(condition, msg)` and `if (!condition) revert(msg)` compile to the same bytecode. Use whichever reads more clearly.

### `assert`

Used for **invariants that should NEVER be false** — internal consistency checks.

```solidity
function split(uint256 total) public pure returns (uint256, uint256) {
    uint256 half = total / 2;
    uint256 remainder = total - half * 2;
    assert(half * 2 + remainder == total); // this MUST always be true
    return (half, remainder);
}
```

**Key difference from `require`:**
- `require` → expected failure (bad input, insufficient funds) → refunds remaining gas
- `assert` → unexpected failure (bug in your code) → **consumes ALL remaining gas**

Use `assert` only to catch things that indicate a bug in your contract logic. If it ever fires in production, something is seriously wrong.

---

## 5. Custom Errors

Before Solidity 0.8.4, error messages were just strings:
```solidity
require(balance >= amount, "Insufficient balance");
```

This stores the string `"Insufficient balance"` in the bytecode — expensive in gas.

**Custom errors** are cheaper because they're identified by a 4-byte selector (like function selectors), not a full string:

```solidity
// Declare at contract level (or file level)
error InsufficientBalance(uint256 available, uint256 required);
error Unauthorized(address caller);
error ZeroAddress();

contract Wallet {
    mapping(address => uint256) public balances;
    address public owner;

    function withdraw(uint256 amount) public {
        if (balances[msg.sender] < amount) {
            revert InsufficientBalance(balances[msg.sender], amount);
        }
        balances[msg.sender] -= amount;
    }

    function adminReset(address user) public {
        if (msg.sender != owner) {
            revert Unauthorized(msg.sender);
        }
        balances[user] = 0;
    }
}
```

**Why custom errors are better:**
- Cheaper to deploy (no strings in bytecode)
- Cheaper to revert (less calldata in the revert reason)
- Can carry parameters — you can see *why* it failed, not just that it failed
- Frontend can decode them easily via ABI

**The pattern:**
```solidity
// old way
require(msg.sender == owner, "Not owner");

// new way (preferred)
if (msg.sender != owner) revert Unauthorized(msg.sender);
```

Both do the same thing. In real contracts written today, you'll see custom errors almost exclusively.

---

## 6. The CEI Pattern (Preview)

Control flow in Solidity has a famous security rule:

**Checks → Effects → Interactions**

```solidity
function withdraw(uint256 amount) public {
    // 1. CHECKS — validate everything first
    require(balances[msg.sender] >= amount, "insufficient");

    // 2. EFFECTS — update state before any external call
    balances[msg.sender] -= amount;

    // 3. INTERACTIONS — external calls last
    payable(msg.sender).transfer(amount);
}
```

If you do the external call (step 3) before the state update (step 2), you're vulnerable to reentrancy — the caller can re-enter your function before the balance is decremented. This is how The DAO was drained for $60M.

We'll cover reentrancy in full in S10, but the pattern starts here: **always update state before sending ETH or calling external contracts.**

---

## 7. Putting It Together — Auction Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error BiddingClosed();
error BidTooLow(uint256 current, uint256 sent);
error AlreadyFinalized();

contract SimpleAuction {
    address public highestBidder;
    uint256 public highestBid;
    bool public ended;
    address public owner;

    mapping(address => uint256) public refunds;

    constructor() {
        owner = msg.sender;
    }

    function bid() external payable {
        // CHECKS
        if (ended) revert BiddingClosed();
        if (msg.value <= highestBid) revert BidTooLow(highestBid, msg.value);

        // EFFECTS
        if (highestBidder != address(0)) {
            refunds[highestBidder] += highestBid; // queue the refund
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
    }

    function claimRefund() external {
        uint256 amount = refunds[msg.sender];
        require(amount > 0, "nothing to refund");

        // EFFECTS before INTERACTION
        refunds[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function finalize() external {
        if (msg.sender != owner) revert BiddingClosed();
        if (ended) revert AlreadyFinalized();
        ended = true;
        payable(owner).transfer(highestBid);
    }
}
```

Notice:
- Custom errors for all failure cases
- CEI pattern in both `bid()` and `claimRefund()`
- Refunds are queued (not pushed) — safer pattern (covered in S10)
- `require` used for the simple `amount > 0` check where string is fine

---

## Summary

| Tool | When to use |
|------|------------|
| `if/else` | Branching logic |
| `for/while` | Iteration — keep bounded |
| `require(cond, msg)` | Input validation, expected failures |
| `if (!cond) revert CustomError()` | Same as require, preferred in modern Solidity |
| `assert(cond)` | Internal invariants — should never fire |
| Custom errors | Always prefer over string messages in 0.8.4+ |

---

→ **Practice Set P-S2** — Control flow exercises
→ After that: **S3: Data Structures**
