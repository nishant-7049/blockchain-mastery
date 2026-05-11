# S4 — OOP in Solidity

> Covers: contracts, inheritance, interfaces, abstract contracts, libraries

---

## 1. Contracts as Objects

In Solidity, a contract is similar to a class in OOP. It has:
- State variables (fields)
- Functions (methods)
- A constructor
- Access control (visibility)

```solidity
contract Animal {
    string public name;
    uint256 public age;

    constructor(string memory _name, uint256 _age) {
        name = _name;
        age = _age;
    }

    function speak() public pure virtual returns (string memory) {
        return "...";
    }
}
```

The `virtual` keyword means: *this function can be overridden by a child contract.*

---

## 2. Inheritance

A child contract inherits all state variables and functions from its parent.

```solidity
contract Dog is Animal {
    constructor(string memory _name, uint256 _age)
        Animal(_name, _age)   // call parent constructor
    {}

    function speak() public pure override returns (string memory) {
        return "Woof";
    }
}
```

- `is Animal` — declares inheritance
- `Animal(_name, _age)` — passes args to parent constructor
- `override` — tells compiler this function replaces the parent's version

**Calling parent functions with `super`:**
```solidity
contract GuideDog is Dog {
    function speak() public pure override returns (string memory) {
        string memory base = super.speak(); // calls Dog.speak() → "Woof"
        return string.concat(base, " (trained)");
    }
}
```

`super` calls the next function up the inheritance chain.

---

## 3. Multiple Inheritance

Solidity supports multiple inheritance — a contract can inherit from multiple parents.

```solidity
contract A {
    function hello() public pure virtual returns (string memory) {
        return "A";
    }
}

contract B is A {
    function hello() public pure virtual override returns (string memory) {
        return "B";
    }
}

contract C is A, B {
    function hello() public pure override(A, B) returns (string memory) {
        return super.hello(); // calls B.hello() — rightmost parent wins
    }
}
```

**The Diamond Problem & C3 Linearization:**

When multiple parents define the same function, Solidity uses C3 linearization — it resolves which parent's function to call by going **right to left** in the `is` declaration. `C is A, B` → B takes priority over A.

You must list parents from **most base** to **most derived**:
```solidity
contract C is A, B { }  // ✅ A is base, B extends A
contract C is B, A { }  // ❌ will not compile if B already extends A
```

---

## 4. Abstract Contracts

An abstract contract is one that has at least one function without an implementation. It cannot be deployed — it must be inherited and completed.

```solidity
abstract contract Shape {
    function area() public pure virtual returns (uint256);   // no body
    function perimeter() public pure virtual returns (uint256); // no body

    function describe() public pure returns (string memory) {
        return "I am a shape"; // concrete function — can have implementation
    }
}

contract Rectangle is Shape {
    uint256 public width;
    uint256 public height;

    constructor(uint256 w, uint256 h) {
        width = w;
        height = h;
    }

    function area() public view override returns (uint256) {
        return width * height;
    }

    function perimeter() public view override returns (uint256) {
        return 2 * (width + height);
    }
}
```

If you inherit an abstract contract but don't implement all its functions, your contract must also be marked `abstract`.

**Abstract vs concrete:**
- Abstract = template, cannot be deployed alone
- Concrete = fully implemented, can be deployed

---

## 5. Interfaces

An interface is a stricter version of an abstract contract:
- **No state variables**
- **No constructor**
- **No function bodies at all**
- All functions are implicitly `external`
- Cannot inherit from contracts — only from other interfaces

```solidity
interface IToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}
```

**Implementing an interface:**
```solidity
contract MyToken is IToken {
    mapping(address => uint256) private _balances;

    function transfer(address to, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        // allowance logic
        return true;
    }
}
```

**The real power — calling external contracts through interfaces:**

You don't need the full contract code to interact with a deployed contract. You just need its interface:

```solidity
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Treasury {
    function sendTokens(address tokenAddress, address recipient, uint256 amount) external {
        IERC20 token = IERC20(tokenAddress); // cast address to interface
        bool success = token.transfer(recipient, amount);
        require(success, "transfer failed");
    }
}
```

`IERC20(tokenAddress)` tells Solidity: *"treat this address as a contract that implements IERC20."* You can now call its functions without having its source code.

This is how DeFi protocols interact with each other — Uniswap calls Aave calls Compound, all through interfaces.

---

## 6. Abstract vs Interface — When to Use Which

| | Abstract Contract | Interface |
|---|---|---|
| State variables | ✅ allowed | ❌ not allowed |
| Constructor | ✅ allowed | ❌ not allowed |
| Function bodies | ✅ some can have bodies | ❌ none allowed |
| Inheritance | contracts + interfaces | interfaces only |
| Use case | Shared base with some logic | Pure contract standard/ABI |
| Example | `ERC20` base contract | `IERC20` standard |

**Rule of thumb:**
- Defining a **standard** that others must follow → interface
- Sharing **reusable logic** between contracts → abstract contract

---

## 7. Libraries

Libraries are like utility contracts — stateless, reusable functions you can attach to types.

```solidity
library MathLib {
    function square(uint256 x) internal pure returns (uint256) {
        return x * x;
    }

    function clamp(uint256 val, uint256 min, uint256 max) internal pure returns (uint256) {
        if (val < min) return min;
        if (val > max) return max;
        return val;
    }
}

contract Calculator {
    using MathLib for uint256; // attach library to uint256 type

    function squareOf(uint256 x) public pure returns (uint256) {
        return x.square(); // x is passed as first argument automatically
    }

    function clampScore(uint256 score) public pure returns (uint256) {
        return score.clamp(0, 100);
    }
}
```

`using MathLib for uint256` — attaches all `MathLib` functions to `uint256`. When you call `x.square()`, Solidity passes `x` as the first argument to `MathLib.square(x)`.

**Library rules:**
- Cannot have state variables
- Cannot be deployed with `new` (internal libraries are inlined into bytecode)
- `internal` functions → inlined at compile time (no external call, cheaper)
- `public` functions → deployed separately, called via DELEGATECALL

**Real example — OpenZeppelin's SafeERC20:**
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    function deposit(IERC20 token, uint256 amount) external {
        token.safeTransfer(msg.sender, amount); // library function on IERC20 type
    }
}
```

---

## 8. Full Example — Token System with OOP

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface — the standard
interface IToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    event Transfer(address indexed from, address indexed to, uint256 amount);
}

// Library — reusable validation
library TokenLib {
    function isValidAddress(address addr) internal pure returns (bool) {
        return addr != address(0);
    }
}

// Abstract base — shared logic
abstract contract BaseToken is IToken {
    using TokenLib for address;

    mapping(address => uint256) internal _balances;
    string public name;
    uint256 public totalSupply;

    constructor(string memory _name, uint256 initialSupply) {
        name = _name;
        _balances[msg.sender] = initialSupply;
        totalSupply = initialSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    // shared transfer logic — child must call this
    function _transfer(address from, address to, uint256 amount) internal {
        require(to.isValidAddress(), "invalid recipient");
        require(_balances[from] >= amount, "insufficient balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }
}

// Concrete implementation
contract SimpleToken is BaseToken {
    constructor(string memory _name, uint256 supply)
        BaseToken(_name, supply)
    {}

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
}
```

Notice the layering:
- `IToken` defines the standard (what functions must exist)
- `TokenLib` provides reusable validation
- `BaseToken` implements shared logic (`balanceOf`, `_transfer`)
- `SimpleToken` is the concrete deployable contract

---

## Summary

| Concept | Key point |
|---------|-----------|
| Inheritance (`is`) | Child gets all parent state + functions |
| `virtual` | Function can be overridden |
| `override` | Function replaces parent's version |
| `super` | Calls parent's version of a function |
| Abstract contract | Has unimplemented functions, cannot deploy alone |
| Interface | No state, no bodies, defines a standard |
| Library | Stateless utilities, attach to types with `using ... for` |
| Multiple inheritance | Right-to-left priority, C3 linearization |

---

→ **Practice Set P-S4** — OOP exercises
→ After that: **S5: Special Variables**
