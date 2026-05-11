# Practice Set P-S3 — Data Structures

> Covers: S3 — mappings, arrays, structs, enums, nested mappings
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — True or False

Answer true or false and explain why in one line.

1. `mapping(address => uint256) balances` — if I read `balances[0xABC]` before setting it, the transaction reverts.
2. `delete arr[2]` on a `uint256[]` removes the element and shrinks the array by 1.
3. A `memory` array can be grown with `.push()` inside a function.
4. Enums are stored as `uint8` on-chain.
5. You can iterate over all keys in a mapping using a for loop.
6. `Student storage s = students[addr]` copies the struct into a new variable.

---

## Exercise 2 — Spot the Bug

Each snippet has one bug. Find it and write the fix.

**2a.**
```solidity
uint256[] public scores;

function getTopThree() public view returns (uint256[] memory) {
    uint256[] memory top = new uint256[](3);
    top.push(scores[0]);
    top.push(scores[1]);
    top.push(scores[2]);
    return top;
}
```

**2b.**
```solidity
mapping(address => uint256) public balances;

function clearBalance(address user) public {
    delete balances;
}
```

**2c.**
```solidity
enum State { Idle, Running, Stopped }
State public current = State.Idle;

function stop() public {
    require(current == 2, "not running");
    current = State.Stopped;
}
```

**2d.**
```solidity
struct Item {
    string name;
    uint256 price;
}

mapping(uint256 => Item) public items;

function updatePrice(uint256 id, uint256 newPrice) public {
    Item memory item = items[id];
    item.price = newPrice;
}
```

---

## Exercise 3 — Fill in the Blanks

```solidity
contract Shop {
    enum OrderStatus { ________, ________, ________, ________ }
    // (a) fill in 4 meaningful states for an order lifecycle

    struct Order {
        address buyer;
        uint256 amount;
        __________ status;   // (b) correct type for the status field
    }

    mapping(uint256 => Order) public orders;
    uint256[] public orderIds;           // (c) why do we need this array alongside the mapping?

    uint256 private nextId = 1;

    function createOrder() external payable {
        if (msg.value == 0) revert();
        orders[nextId] = Order({
            buyer: __________,           // (d)
            amount: __________,          // (e)
            status: __________           // (f) initial status
        });
        __________.push(nextId);         // (g) track the id
        nextId++;
    }

    function complete(uint256 id) external {
        Order __________ o = orders[id]; // (h) storage or memory? why?
        o.status = OrderStatus.________; // (i) correct final state
    }
}
```

---

## Exercise 4 — Nested Mapping

Write a contract called `Allowance` that replicates ERC-20 allowance logic:

1. `mapping(address => mapping(address => uint256)) public allowances` — owner → spender → amount
2. `approve(address spender, uint256 amount)` — sets `allowances[msg.sender][spender] = amount`
3. `transferFrom(address owner, address to, uint256 amount)` — checks allowance, deducts it, then transfers from `balances[owner]` to `balances[to]`
4. `allowanceOf(address owner, address spender)` — returns the allowance

Also add a `deposit()` function so users can fund their balance to test with.

Custom errors: `InsufficientAllowance(uint256 available, uint256 required)`, `InsufficientBalance(uint256 available, uint256 required)`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// errors here

contract Allowance {
    // your code here
}
```

---

## Exercise 5 — Array Removal

Write a contract called `MemberList` that:

1. Has `address[] public members` and `mapping(address => bool) public isMember`
2. `addMember(address member)` — adds to array and mapping, reverts if already a member
3. `removeMember(address member)` — removes using swap-and-pop, sets `isMember[member] = false`, reverts if not a member
4. `getMemberCount()` — returns `members.length`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MemberList {
    // your code here
}
```

---

## Exercise 6 — Write a Voting Tally Contract

Write a contract called `VotingTally` that:

1. Define a struct `Candidate` with fields: `string name`, `uint256 voteCount`
2. Define an enum `Phase` with states: `Registration`, `Voting`, `Ended`
3. State variables:
   - `Phase public currentPhase`
   - `mapping(uint256 => Candidate) public candidates`
   - `uint256[] public candidateIds`
   - `mapping(address => bool) public hasVoted`
   - `address public immutable admin`
4. Functions:
   - `addCandidate(uint256 id, string calldata name)` — admin only, only during `Registration` phase
   - `startVoting()` — admin only, moves phase from `Registration` → `Voting`
   - `vote(uint256 candidateId)` — only during `Voting` phase, each address can vote once, increments `voteCount`
   - `endVoting()` — admin only, moves phase to `Ended`
   - `getWinner()` — only callable after `Ended`, loops through `candidateIds`, returns name and voteCount of the winner

Use custom errors for all failure cases.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// errors here

contract VotingTally {
    // your code here
}
```

---

> Share your answers and we'll review. After that: **S4: OOP in Solidity**.
