# Practice Set P-S6 — ETH Handling

> Covers: S6 — payable, receive, fallback, transfer vs send vs call, push vs pull
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — True or False

Answer true or false and explain why in one line.

1. A non-payable function can receive ETH if you send a small enough amount.
2. `receive()` is triggered when ETH is sent with calldata that matches no function.
3. `.transfer()` automatically reverts if the transfer fails.
4. `.call{value: x}("")` returns a bool that you must check manually.
5. The pull pattern is safer than the push pattern because failures are isolated per user.
6. `fallback()` can only be triggered if the contract has no `receive()`.
7. You can send ETH to an address without marking it `payable` in Solidity.

---

## Exercise 2 — What Triggers?

For each scenario, say which function is triggered: `receive()`, `fallback()`, a named function, or revert.

Assume this contract:
```solidity
contract Target {
    uint256 public count;

    receive() external payable { count += 1; }
    fallback() external payable { count += 10; }

    function deposit() external payable { count += 100; }
    function ping() external { count += 1000; }
}
```

1. Someone sends 1 ETH to the contract with no calldata.
2. Someone calls `deposit()` with 0.5 ETH.
3. Someone calls `ping()` with 0.1 ETH attached.
4. Someone calls a function `foo()` that doesn't exist, with 1 ETH.
5. Someone calls a function `bar()` that doesn't exist, with no ETH.
6. Someone sends 0 ETH with no calldata.

---

## Exercise 3 — Spot the Bug

Each snippet has one or more bugs. Find and fix them.

**3a.**
```solidity
function sendReward(address recipient, uint256 amount) internal {
    payable(recipient).transfer(amount);
}
```

**3b.**
```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "nothing");
    (bool ok,) = payable(msg.sender).call{value: amount}("");
    require(ok, "failed");
    balances[msg.sender] = 0; // update after transfer
}
```

**3c.**
```solidity
receive() external {
    balances[msg.sender] += msg.value;
}
```

**3d.**
```solidity
function pay(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    to.call{value: amount}("");
}
```

---

## Exercise 4 — Fill in the Blanks

```solidity
contract EthRouter {
    mapping(address => uint256) public _________;  // (a) tracks pending claims per user

    // triggered when ETH sent with no calldata
    _________ () external _________ {              // (b) function name and keyword
        _________[msg.sender] += msg.value;        // (c) queue the deposit
    }

    function deposit() external _________ {        // (d) must accept ETH
        _________[msg.sender] += _________;        // (e) track deposit amount
    }

    function withdraw() external {
        uint256 amount = _________[msg.sender];    // (f) how much can they claim
        if(amount == 0) revert();

        _________[msg.sender] = 0;                 // (g) CEI — zero before sending

        (bool ok,) = _________(_________).call{value: _________}(""); // (h) send ETH
        require(ok, "failed");
    }
}
```

---

## Exercise 5 — Push vs Pull

This contract uses the push pattern and has a critical bug. 

1. Explain what the bug is
2. Rewrite it using the pull pattern to fix it

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RewardDistributor {
    address[] public winners;
    uint256 public rewardPerWinner;
    address public immutable owner;

    constructor() payable {
        owner = msg.sender;
        rewardPerWinner = msg.value;
    }

    function addWinner(address winner) external {
        require(msg.sender == owner);
        winners.push(winner);
        rewardPerWinner = address(this).balance / winners.length;
    }

    function distributeAll() external {
        require(msg.sender == owner);
        for (uint256 i = 0; i < winners.length; i++) {
            (bool ok,) = payable(winners[i]).call{value: rewardPerWinner}("");
            require(ok, "failed"); // ← the bug
        }
    }
}
```

---

## Exercise 6 — Write a Contract

Write a contract called `EtherWallet` that:

1. Has an `owner` set at deployment (immutable)
2. `receive()` — accepts ETH sent directly, adds to `balance`
3. `deposit()` — payable, explicit deposit, adds to `balance`
4. `withdraw(uint256 amount)` — only owner:
   - Must have sufficient balance
   - Follows CEI
   - Uses `.call` to send ETH
5. `withdrawAll()` — only owner, drains entire balance, follows CEI
6. `getBalance()` — returns `address(this).balance`
7. `fallback()` — payable, treats unknown calls same as `receive()` (adds to balance)

Use custom errors for all failures.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// errors here

contract EtherWallet {
    // your code here
}
```

---

> Share your answers and we'll review. After that: **S7: Events & Logging**.
