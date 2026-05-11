# Practice Set P-S2 — Control Flow

> Covers: S2 — if/else, loops, require/revert/assert, custom errors, CEI pattern
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — Spot the Bug

Each function has one bug. Identify it and write the fix.

**1a.**
```solidity
function isAdult(uint256 age) public pure returns (bool) {
    if (age) {
        return true;
    }
    return false;
}
```

**1b.**
```solidity
function divide(uint256 a, uint256 b) public pure returns (uint256) {
    return a / b;
}
```

**1c.**
```solidity
function withdraw(uint256 amount) public {
    balances[msg.sender] -= amount;                 // line 1
    require(balances[msg.sender] >= amount, "...");  // line 2
    payable(msg.sender).transfer(amount);            // line 3
}
```

**1d.**
```solidity
function onlyPositive(uint256 x) public pure returns (uint256) {
    assert(x > 0, "must be positive");
    return x;
}
```

---

## Exercise 2 — require vs revert vs assert

For each situation, say which one to use (`require`, `revert`, or `assert`) and why.

1. Checking that the caller sent at least 0.1 ETH
2. Checking that after splitting a uint256 in half, the two halves add up to the original
3. Checking that a token recipient address is not `address(0)`
4. Inside a complex if/else chain where the condition is long and hard to read in a require
5. Checking that a user's balance is never negative (invariant that should be mathematically impossible)

---

## Exercise 3 — Custom Errors

Rewrite this contract to use custom errors instead of string messages. Add relevant parameters to each error where useful.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
    address public owner;
    mapping(address => uint256) public balances;

    constructor() {
        owner = msg.sender;
    }

    function deposit() public payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(amount > 0, "Amount must be positive");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function adminWithdraw(uint256 amount) public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(amount);
    }
}
```

---

## Exercise 4 — Fix the Loop

This function is dangerous. Explain why and rewrite it safely.

```solidity
address[] public stakers;
mapping(address => uint256) public rewards;

function distributeRewards(uint256 rewardPerStaker) public {
    for (uint256 i = 0; i < stakers.length; i++) {
        payable(stakers[i]).transfer(rewardPerStaker);
    }
}
```

---

## Exercise 5 — Fill in the Blanks

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error _____________(address caller);          // (a) error for unauthorized access
error _____________(uint256 min, uint256 sent); // (b) error for bid too low

contract Bidding {
    address public owner;
    uint256 public minBid;
    address public topBidder;
    uint256 public topBid;

    constructor(uint256 _minBid) {
        owner = ___________;    // (c)
        minBid = _minBid;
    }

    function bid() external __________ {    // (d) must accept ETH
        if (msg.value ___ topBid) {         // (e) condition: bid must be strictly higher
            revert ___________(minBid, msg.value);  // (f) use the correct custom error
        }
        topBidder = msg.sender;
        topBid = msg.value;
    }

    function reset() external {
        if (___________ != owner) revert ___________(msg.sender);  // (g) access check
        topBidder = address(0);
        topBid = 0;
    }
}
```

---

## Exercise 6 — CEI Pattern

This contract has a reentrancy vulnerability. Identify the issue and rewrite the `withdraw` function correctly using the CEI pattern.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PiggyBank {
    mapping(address => uint256) public savings;

    function deposit() external payable {
        savings[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = savings[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        // sends ETH first
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        // updates state after
        savings[msg.sender] = 0;
    }
}
```

---

## Exercise 7 — Write a Contract

Write a contract called `AccessVault` that:

1. Has an `owner` set in the constructor
2. Stores a `uint256 public secretNumber` — only the owner can change it
3. Has a `setNumber(uint256 _num)` function:
   - Reverts with a custom error `Unauthorized(address caller)` if caller is not owner
   - Reverts with a custom error `InvalidNumber(uint256 given)` if `_num` is 0
   - Otherwise sets `secretNumber = _num`
4. Has a `doubleIt()` function:
   - Doubles `secretNumber`
   - Uses `assert` to verify the result is exactly double the original after the operation
5. Has a `getNumber()` function that returns `secretNumber` — read only, no ETH

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// your custom errors here

contract AccessVault {
    // your code here
}
```

---

> Share your answers and we'll review each one. After that: **S3: Data Structures**.
