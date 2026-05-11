# Practice Set P-S5 — Special Variables

> Covers: S5 — msg.*, block.*, tx.origin, address(this), gasleft()
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — True or False

Answer true or false and explain why in one line.

1. `msg.sender` inside ContractB is always the EOA that signed the transaction.
2. `msg.value` can be non-zero in a non-payable function.
3. `tx.origin` is safe to use for access control in all cases.
4. `block.timestamp` can be used reliably for randomness.
5. `address(this).balance` returns the ETH held by the current contract in wei.
6. `block.number` increases by 1 roughly every 12 seconds on Ethereum mainnet.
7. `msg.sender` and `tx.origin` are always the same address.

---

## Exercise 2 — What Does It Return?

For each scenario, write what `msg.sender` and `tx.origin` will be inside the final contract called.

**Scenario A:**
```
UserA (EOA) calls ContractA directly
→ Inside ContractA: msg.sender = ?, tx.origin = ?
```

**Scenario B:**
```
UserA (EOA) calls ContractA
ContractA calls ContractB
→ Inside ContractB: msg.sender = ?, tx.origin = ?
```

**Scenario C:**
```
UserA (EOA) calls ContractA
ContractA calls ContractB
ContractB calls ContractC
→ Inside ContractC: msg.sender = ?, tx.origin = ?
```

**Scenario D:**
```
UserA calls MaliciousContract
MaliciousContract calls VictimContract which uses tx.origin == owner for auth
owner == UserA
→ Does the auth check pass? Why?
→ Would it pass if the check used msg.sender instead?
```

---

## Exercise 3 — Spot the Bug

Each snippet has one or more bugs. Find and fix them.

**3a.**
```solidity
function getTimeSinceBlock() public view returns (uint256) {
    return block.number - block.timestamp;
}
```

**3b.**
```solidity
contract Lottery {
    function pickWinner(address[] memory players) public view returns (address) {
        uint256 random = uint256(block.timestamp) % players.length;
        return players[random];
    }
}
```

**3c.**
```solidity
contract Owned {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function adminAction() external {
        require(tx.origin == owner, "not owner");
        // do something sensitive
    }
}
```

**3d.**
```solidity
function checkBalance() external view returns (uint256) {
    return this.balance;
}
```

---

## Exercise 4 — Fill in the Blanks

```solidity
contract AccessLogger {
    address public immutable deployer;
    uint256 public deployedAt;
    uint256 public deployedBlock;

    mapping(address => uint256) public lastSeen;

    constructor() {
        deployer = __________;          // (a) who deployed this
        deployedAt = __________;        // (b) timestamp of deployment
        deployedBlock = __________;     // (c) block number at deployment
    }

    function ping() external {
        lastSeen[__________] = __________;  // (d) record caller → current timestamp
    }

    function contractFunds() external view returns (uint256) {
        return __________._________;        // (e) ETH held by this contract
    }

    function isDeployer() external view returns (bool) {
        return __________ == deployer;      // (f) check if direct caller is deployer
    }

    function onlyEOA() external view returns (bool) {
        // returns true only if the caller is an EOA (not a contract)
        // hint: for EOAs, msg.sender == tx.origin
        return __________ == __________;   // (g)
    }
}
```

---

## Exercise 5 — Write a Contract

Write a contract called `CooldownVault` that:

1. Has an `owner` set at deployment (immutable)
2. Stores `uint256 public balance`
3. Stores `uint256 public lastWithdrawTime` — timestamp of last withdrawal
4. Has a `cooldown` period of 1 day (use a constant: `uint256 public constant COOLDOWN = 1 days`)
5. `deposit()` — payable, anyone can deposit, adds to balance
6. `withdraw(uint256 amount)` — only owner, enforces:
   - Amount must be > 0
   - Balance must be sufficient
   - Must be at least `COOLDOWN` seconds since `lastWithdrawTime`
   - After withdrawal: update `lastWithdrawTime` to `block.timestamp`, subtract from balance, send ETH to owner
7. `timeUntilNextWithdraw()` — returns seconds remaining until next withdrawal allowed (0 if cooldown passed)
8. `contractBalance()` — returns `address(this).balance`

Use custom errors for all failures. Follow CEI pattern.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// errors here

contract CooldownVault {
    // your code here
}
```

---

## Exercise 6 — Read and Answer

Read this contract carefully and answer the questions below.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSigCheck {
    address public owner;
    address public operator;
    uint256 public lastActionBlock;
    uint256 public funds;

    constructor(address _operator) payable {
        owner = msg.sender;
        operator = _operator;
        lastActionBlock = block.number;
        funds = msg.value;
    }

    function action() external {
        require(
            msg.sender == owner || msg.sender == operator,
            "not authorized"
        );
        lastActionBlock = block.number;
    }

    function blocksSinceLastAction() external view returns (uint256) {
        return block.number - lastActionBlock;
    }

    function estimatedSecondsSinceLastAction() external view returns (uint256) {
        return (block.number - lastActionBlock) * 12;
    }

    function drain() external {
        require(tx.origin == owner, "not owner");
        payable(owner).transfer(funds);
        funds = 0;
    }
}
```

Questions:
1. Who sets `owner` and how?
2. Can `operator` call `action()`? What about a random address?
3. What does `estimatedSecondsSinceLastAction()` assume about block time?
4. `drain()` uses `tx.origin` — describe a scenario where this is exploitable.
5. `drain()` also uses `.transfer()` — what is the modern preferred alternative?
6. There's a CEI violation in `drain()` — which lines are in the wrong order and what's the fix?

---

> Share your answers and we'll review. After that: **S6: ETH Handling**.
