# Practice Set P-S1 — Variables & Types

> Covers: S1 Basics — types, variables, storage locations, visibility, mutability, global vars, units
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — Spot the Type

What is the correct Solidity type for each of the following? Pick from:
`uint256`, `int256`, `bool`, `address`, `bytes32`, `string`

1. A user's wallet address: `___________`
2. The number of tokens someone holds (never negative): `___________`
3. A temperature reading that can be negative (e.g. -5°C): `___________`
4. Whether a user has voted or not: `___________`
5. A hashed document ID (32 raw bytes): `___________`
6. A person's name stored on-chain: `___________`

---

## Exercise 2 — Fix the Bugs

Each function below has one bug. Identify the bug and write the corrected line.

**2a.**
```solidity
function getOwner() public pure returns (address) {
    return owner; // owner is a state variable
}
```

**2b.**
```solidity
function deposit() public view {
    balances[msg.sender] += msg.value;
}
```

**2c.**
```solidity
function getDouble(uint256 x) public view returns (uint256) {
    return x * 2;
}
```

**2d.**
```solidity
function _secret() public returns (uint256) {
    return 42;
}
```

---

## Exercise 3 — Fill in the Blanks

Fill in the correct keyword(s):

```solidity
contract Wallet {
    address __________ owner;       // (a) only set once at deploy, can never change

    uint256 __________ balance;     // (b) can be read from outside, modified inside

    __________ totalSupply;         // (c) uint256 that anyone can read, nobody outside can write

    function getBalance() __________ __________ returns (uint256) {  // (d) reads state, no ETH
        return balance;
    }

    function add(uint256 a, uint256 b) __________ __________ returns (uint256) {  // (e) no state, no ETH
        return a + b;
    }

    function fund() __________ {   // (f) must accept ETH
        balance += msg.value;
    }
}
```

---

## Exercise 4 — Storage Locations

For each variable declaration, write where it lives: `storage`, `memory`, or `calldata`.
Also answer: is it permanent on-chain after the function exits? (yes/no)

```solidity
contract Quiz {
    uint256[] public data;

    function process(uint256[] calldata input) external {
        // (a) input         → location: ___  permanent: ___

        uint256[] memory temp = input;
        // (b) temp          → location: ___  permanent: ___

        data = input;
        // (c) data          → location: ___  permanent: ___

        uint256 x = data[0];
        // (d) x             → location: ___  permanent: ___
    }
}
```

---

## Exercise 5 — The Trap

This contract has a subtle bug. Read it carefully and explain:
1. What does the developer *think* they're doing?
2. What actually happens?
3. How do you fix it?

```solidity
contract Names {
    string[] public names;

    function clearFirst() public {
        string storage first = names[0];
        first = "";
    }
}
```

---

## Exercise 6 — Global Variables

What does each expression evaluate to? Give a short description of what it returns.

1. `msg.sender` — `___________`
2. `msg.value` — `___________`
3. `block.timestamp` — `___________`
4. `tx.origin` — `___________`

**Bonus:** If UserA calls ContractA which calls ContractB:
- Inside ContractB, what is `msg.sender`?
- Inside ContractB, what is `tx.origin`?

---

## Exercise 7 — Units

Convert each amount:

1. `1 ether` in wei = `___________`
2. `1 gwei` in wei = `___________`
3. `500 gwei` in ether = `___________`
4. If `msg.value == 1 ether`, what condition checks that the user sent exactly 1 ETH?
   ```solidity
   require(______________, "Must send 1 ETH");
   ```

---

## Exercise 8 — Write a Contract

Write a contract called `SimpleStorage` that:

1. Stores a single `uint256` called `value` — readable by anyone, writable only by the contract
2. Has an `owner` address set in the constructor (to whoever deployed it)
3. Has a `set(uint256 newVal)` function — **only the owner can call it** (no modifiers yet, use an `if` check and `revert`)
4. Has a `get()` function that returns the current `value` — pure read, no state change, no ETH
5. Has a `whoDeployed()` function that returns the owner's address

Write the complete contract below:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    // your code here
}
```

---

## Exercise 9 — Reading Code

Read this contract and answer the questions below:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    address public buyer;
    address public seller;
    uint256 public amount;
    bool public released;

    constructor(address _seller) payable {
        buyer = msg.sender;
        seller = _seller;
        amount = msg.value;
        released = false;
    }

    function release() external {
        if (msg.sender != buyer) revert();
        released = true;
        (bool ok, ) = seller.call{value: amount}("");
        require(ok);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
```

Answer:
1. Who sets the `buyer` address and how?
2. Can someone other than the buyer call `release()`? What stops them?
3. What does `seller.call{value: amount}("")` do in plain English?
4. What does `address(this).balance` return?
5. What visibility is `release()`? What does `external` mean vs `public`?
6. Is `getBalance()` touching any state? What mutability keyword should it have and does it?

---

> Once you've written your answers, share them and we'll go through each one.
> After review, we move to **S2: Control Flow**.
