# Practice Set P-S7 — Events & Logging

> Covers: S7 — event declaration, emit, indexed params, events vs state variables
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — True or False

Answer true or false and explain why in one line.

1. A smart contract can read events emitted by another contract.
2. Indexed parameters are stored in the log's `topics` array and are filterable.
3. You can have 5 indexed parameters in a single event.
4. Events are cheaper than writing to state variables.
5. Events store a full history of changes — state variables only store the current value.
6. You must emit an event before updating state (before effects).
7. Non-indexed parameters cannot be read at all — they are lost after the transaction.

---

## Exercise 2 — Spot the Bug

Each snippet has one or more issues. Find and fix them.

**2a.**
```solidity
event transfer(address from, address to, uint256 amount);

function send(address to, uint256 amount) external {
    balances[msg.sender] -= amount;
    balances[to] += amount;
    emit transfer(msg.sender, to, amount);
}
```

**2b.**
```solidity
event Deposit(address indexed user, uint256 indexed amount, uint256 indexed timestamp, bool indexed isFirst);
```

**2c.**
```solidity
function withdraw(uint256 amount) external {
    emit Withdrawn(msg.sender, amount); // emit first
    balances[msg.sender] -= amount;
    (bool ok,) = payable(msg.sender).call{value: amount}("");
    require(ok);
}
```

**2d.**
```solidity
event PriceUpdated(uint256 oldPrice, uint256 newPrice);

function updatePrice(uint256 newPrice) external {
    price = newPrice;
    emit PriceUpdated(newPrice, price); // log the change
}
```

---

## Exercise 3 — Design the Events

For each contract, write the event declarations (no implementation needed). Think about:
- What should be indexed?
- What data is useful to log?
- What name makes sense?

**3a. A token transfer contract**
Events needed for: transfer between users, minting new tokens, burning tokens.

**3b. A voting contract**
Events needed for: a candidate being registered, a vote being cast, voting ending and a winner declared.

**3c. A staking contract**
Events needed for: user stakes ETH, user unstakes, rewards claimed, reward rate changed by admin.

---

## Exercise 4 — Fill in the Blanks

Add the missing events and emit statements to this contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Registry {
    // declare events here
    event ____________________________;  // (a) user registered — include address and name, address should be filterable
    event ____________________________;  // (b) user removed — include address, should be filterable
    event ____________________________;  // (c) name updated — include address, old name, new name

    mapping(address => string) public names;
    address public immutable admin;

    constructor() {
        admin = msg.sender;
    }

    function register(address user, string calldata name) external {
        require(msg.sender == admin);
        require(bytes(names[user]).length == 0, "already registered");
        names[user] = name;
        emit ____________________________;  // (d) emit correct event with correct args
    }

    function remove(address user) external {
        require(msg.sender == admin);
        require(bytes(names[user]).length > 0, "not registered");
        delete names[user];
        emit ____________________________;  // (e)
    }

    function updateName(address user, string calldata newName) external {
        require(msg.sender == admin);
        string memory oldName = names[user];
        names[user] = newName;
        emit ____________________________;  // (f) include old and new name
    }
}
```

---

## Exercise 5 — Events vs State: Which to Use?

For each piece of data, decide: should it be a **state variable**, an **event**, or **both**? Explain why.

1. The current owner of a contract
2. Every address that ever called `deposit()`
3. The total ETH currently held by the contract
4. A history of all price changes for an asset
5. Whether a user has voted (needed for on-chain enforcement)
6. The timestamp of every withdrawal ever made

---

## Exercise 6 — Write a Contract

Take your `EtherWallet` from P-S6 and upgrade it with full event coverage:

Add these events:
- `Deposited(address indexed sender, uint256 amount)` — emitted on `deposit()` and `receive()`
- `Withdrawn(address indexed owner, uint256 amount)` — emitted on `withdraw()` and `withdrawAll()`
- `FullDrain(address indexed owner, uint256 totalAmount)` — emitted only on `withdrawAll()`

Rules:
- Emit after state changes (CEI order)
- All events properly declared at contract or file level
- Index the address params

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized(address caller);
error InvalidAmount(uint256 amount);
error InsufficientBalance(uint256 available);
error TransferFailed();

contract EtherWallet {
    // events here

    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    receive() external payable { }

    function deposit() external payable { }

    function withdraw(uint256 amount) external { }

    function withdrawAll() external { }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
```

---

> Share your answers and we'll review. After that: **S8: Modifiers & Access Control**.
