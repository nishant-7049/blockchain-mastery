# Practice Set P-S4 — OOP in Solidity

> Covers: S4 — inheritance, abstract contracts, interfaces, libraries, multiple inheritance
> Solve each exercise yourself first. Then we review together.

---

## Exercise 1 — True or False

Answer true or false and explain why in one line.

1. An interface can have state variables.
2. A contract that inherits an abstract contract but doesn't implement all functions must also be marked `abstract`.
3. `override` keyword is needed when a child implements a `virtual` function from its parent.
4. Library functions marked `internal` are deployed as a separate contract on-chain.
5. `super.foo()` calls the function `foo` on the most base contract in the chain.
6. You can deploy an abstract contract directly.
7. All functions in an interface are implicitly `external`.

---

## Exercise 2 — Spot the Bug

Each snippet has one bug. Find it and fix it.

**2a.**
```solidity
interface IVault {
    uint256 public balance;
    function deposit() external payable;
}
```

**2b.**
```solidity
contract Base {
    function greet() public pure returns (string memory) {
        return "hello";
    }
}

contract Child is Base {
    function greet() public pure override returns (string memory) {
        return "hi";
    }
}
```

**2c.**
```solidity
abstract contract Animal {
    function speak() public pure virtual returns (string memory);
}

contract Cat is Animal {
    function speak() public pure returns (string memory) {
        return "meow";
    }
}
```

**2d.**
```solidity
library StringLib {
    uint256 public count = 0;

    function isEmpty(string memory s) internal pure returns (bool) {
        return bytes(s).length == 0;
    }
}
```

**2e.**
```solidity
contract A {
    function hello() public pure virtual returns (string memory) { return "A"; }
}
contract B is A {
    function hello() public pure virtual override returns (string memory) { return "B"; }
}
contract C is B, A {
    function hello() public pure override(A, B) returns (string memory) {
        return super.hello();
    }
}
```

---

## Exercise 3 — Fill in the Blanks

```solidity
__________ IPayable {                          // (a) correct keyword
    function pay(address to) __________ payable; // (b) correct visibility for interface functions
}

__________ contract Escrow is IPayable {       // (c) cannot be deployed — has unimplemented function
    address __________ __________ owner;       // (d) set once, readable outside

    constructor() {
        owner = msg.sender;
    }

    function _validateAddress(address addr) __________ pure returns (bool) { // (e) not callable outside contract
        return addr != address(0);
    }
}

contract SafeEscrow is Escrow {
    function pay(address to) external __________ __________  {  // (f) accepts ETH, replaces interface function
        require(_validateAddress(to), "invalid");
        payable(to).call{value: msg.value}("");
    }
}
```

---

## Exercise 4 — Write a Library

Write a library called `ArrayLib` with these functions — all `internal`:

1. `contains(uint256[] memory arr, uint256 val)` → returns `bool` — true if val exists in arr
2. `sum(uint256[] memory arr)` → returns `uint256` — sum of all elements
3. `max(uint256[] memory arr)` → returns `uint256` — largest element (revert if array is empty)

Then write a contract `Stats` that:
- Uses `using ArrayLib for uint256[]`
- Has a `uint256[] public data` state variable
- `add(uint256 val)` — adds to data, reverts if val already exists (use `contains`)
- `total()` — returns sum of all data
- `largest()` — returns max value

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ArrayLib {
    // your code
}

contract Stats {
    // your code
}
```

---

## Exercise 5 — Inherit and Extend

Given this base contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract Ownable {
    address public immutable owner;

    error Unauthorized(address caller);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }
}
```

Write a contract `OwnedVault` that:
1. Inherits `Ownable`
2. Has `uint256 public balance`
3. `deposit()` — payable, anyone can call, adds `msg.value` to balance
4. `withdraw(uint256 amount)` — only owner, subtracts from balance, sends ETH to owner
5. `emergencyDrain()` — only owner, sends entire contract balance to owner, sets balance to 0

You do not need to rewrite `Ownable`. Just inherit and use `onlyOwner`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// paste Ownable above or import it

contract OwnedVault is Ownable {
    // your code
}
```

---

## Exercise 6 — Interface + Implementation

Write an interface `IRegistry` and two contracts that implement it:

**Interface `IRegistry`:**
- `register(string calldata name) external`
- `isRegistered(address user) external view returns (bool)`
- `getName(address user) external view returns (string memory)`

**Contract `BasicRegistry`:**
- Implements `IRegistry`
- Stores `mapping(address => string) private _names`
- `register` — saves `msg.sender → name`, reverts if already registered
- `isRegistered` — returns true if name is not empty
- `getName` — returns name for given address

**Contract `AdminRegistry`:**
- Implements `IRegistry`
- Only an admin can register addresses on behalf of others
- `register(string calldata name)` — registers `msg.sender` (admin calls on behalf)
- Add an extra function `adminRegister(address user, string calldata name)` — admin registers a specific address

Use custom errors for all failures.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRegistry {
    // your code
}

contract BasicRegistry is IRegistry {
    // your code
}

contract AdminRegistry is IRegistry {
    // your code
}
```

---

> Share your answers and we'll review. After that: **S5: Special Variables**.
