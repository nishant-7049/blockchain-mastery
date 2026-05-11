# S8 — Modifiers & Access Control

## What Problem Are We Solving?

Without access control, any external address can call any function in your contract. That means:
- Anyone can withdraw funds
- Anyone can pause/unpause the contract
- Anyone can change the owner

Access control is how you enforce **who can do what**. Modifiers are Solidity's mechanism for expressing reusable pre/post conditions on functions.

---

## 1. Custom Modifiers

A modifier is a reusable piece of code that wraps a function. It runs before (and optionally after) the function body.

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not the owner");
    _;  // <-- this is where the function body executes
}
```

The `_;` is a placeholder — it means "run the function body here." Without it, the function body never runs.

### Using a modifier:

```solidity
function withdraw() external onlyOwner {
    // only owner reaches this code
    payable(owner).transfer(address(this).balance);
}
```

### Multiple modifiers on one function:

```solidity
function emergencyWithdraw() external onlyOwner whenNotPaused {
    // both conditions must pass
}
```

They execute left to right. `onlyOwner` runs first, then `whenNotPaused`, then the function body.

---

## 2. Modifiers With Parameters

Modifiers can take arguments just like functions:

```solidity
modifier onlyRole(bytes32 role) {
    require(hasRole[msg.sender][role], "Missing role");
    _;
}

function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    // ...
}
```

---

## 3. Post-condition Modifiers

The `_;` doesn't have to be at the end. Code after `_;` runs *after* the function body:

```solidity
modifier noReentrancy() {
    require(!locked, "Reentrant call");
    locked = true;
    _;
    locked = false;  // runs AFTER function body completes
}
```

This is the classic reentrancy guard. More on this in S10.

---

## 4. The onlyOwner Pattern

The simplest and most common access control pattern:

```solidity
contract Owned {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
```

**Pattern:** store `owner` in state, set it in constructor, restrict functions with the modifier.

---

## 5. Role-Based Access Control (RBAC)

`onlyOwner` is a single-admin model — it doesn't scale. Real protocols need roles:
- `ADMIN` — can upgrade contracts, pause
- `MINTER` — can mint tokens
- `PAUSER` — can pause/unpause
- `OPERATOR` — can execute specific operations

### Manual RBAC:

```solidity
contract RBAC {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    mapping(bytes32 => mapping(address => bool)) public roles;
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "Missing role");
        _;
    }

    function grantRole(bytes32 role, address account) external onlyAdmin {
        roles[role][account] = true;
    }

    function revokeRole(bytes32 role, address account) external onlyAdmin {
        roles[role][account] = false;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        // mint logic
    }
}
```

### Why `keccak256("MINTER_ROLE")`?

Instead of using strings (expensive) or magic numbers (error-prone), we use hashed constants. They're:
- Fixed size (32 bytes)
- Readable as named constants in code
- Cheap to compare

---

## 6. OpenZeppelin's Ownable

Writing your own `Ownable` every time is error-prone. OpenZeppelin provides battle-tested contracts.

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    constructor() Ownable(msg.sender) {}

    function sensitiveAction() external onlyOwner {
        // only owner
    }
}
```

OZ's `Ownable` gives you:
- `owner()` — read the current owner
- `onlyOwner` modifier
- `transferOwnership(address)` — transfer to a new owner
- `renounceOwnership()` — permanently remove ownership (dangerous!)

**OZ v5 note:** The constructor now requires explicitly passing the initial owner: `Ownable(msg.sender)`.

---

## 7. OpenZeppelin's AccessControl

OZ's full RBAC implementation:

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Token is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        // mint
    }
}
```

Key concepts:
- `DEFAULT_ADMIN_ROLE` — the root role; can grant/revoke all other roles
- `_grantRole(role, account)` — internal, used in constructor
- `grantRole(role, account)` — external, requires caller to be the role's admin
- `revokeRole(role, account)` — remove a role
- `renounceRole(role, account)` — an account removes its own role
- `hasRole(role, account)` — check if an account has a role

The `onlyRole(MINTER_ROLE)` modifier comes from `AccessControl`.

---

## 8. Two-Step Ownership Transfer

A common bug: you transfer ownership to a wrong address and lock yourself out.

The safe pattern is two-step:

```solidity
contract Ownable2Step {
    address public owner;
    address public pendingOwner;

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}
```

The new owner must *accept* — if you put in a wrong address, the current owner can correct it before it's accepted. OZ provides `Ownable2Step` for this.

---

## 9. Pause Pattern

Many contracts implement pause for emergencies:

```solidity
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MyProtocol is Ownable, Pausable {
    constructor() Ownable(msg.sender) {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function deposit(uint256 amount) external whenNotPaused {
        // only works when not paused
    }
}
```

OZ's `Pausable` gives you:
- `paused()` — read current state
- `whenNotPaused` / `whenPaused` modifiers
- `_pause()` / `_unpause()` internal functions

---

## 10. Common Mistakes

### Mistake 1: Using `tx.origin` for auth

```solidity
// DANGEROUS — phishing attack vector
modifier onlyOwner() {
    require(tx.origin == owner, "Not owner");
    _;
}
```

A malicious contract can trick the owner into calling it, which then calls your contract. `tx.origin` is the original EOA — it stays the same across the chain. Always use `msg.sender`.

### Mistake 2: Missing zero-address checks

```solidity
function transferOwnership(address newOwner) external onlyOwner {
    owner = newOwner;  // if newOwner is 0x0, ownership is lost forever
}

// Safe:
function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "Zero address");
    owner = newOwner;
}
```

### Mistake 3: Constructor forgetting to set roles

```solidity
constructor() {
    // forgot to grant DEFAULT_ADMIN_ROLE to deployer
    // now nobody can grant roles, contract is stuck
}
```

### Mistake 4: Modifier with no `_;`

```solidity
modifier broken() {
    require(condition, "fail");
    // missing _; — function body never runs
}
```

---

## 11. Modifier Execution Order — Mental Model

```solidity
function foo() external modA modB modC {
    // body
}
```

Execution order:
```
modA: before-code
  modB: before-code
    modC: before-code
      body
    modC: after-code (if any)
  modB: after-code (if any)
modA: after-code (if any)
```

It's like nested wrappers. This matters when you have post-condition modifiers like reentrancy guards.

---

## Summary

| Concept | What it does |
|---------|-------------|
| `modifier` | Reusable pre/post condition for functions |
| `_;` | Placeholder where function body runs |
| `onlyOwner` | Single-admin access control |
| RBAC | Multi-role access via mappings |
| `bytes32` roles | Gas-efficient role identifiers |
| OZ `Ownable` | Battle-tested single-owner contract |
| OZ `AccessControl` | Production-grade RBAC |
| `Pausable` | Emergency stop mechanism |
| Two-step transfer | Safe ownership handover |

---

## What's Next

**P-S8** — Practice set: you'll build reusable modifiers, implement an RBAC system from scratch, and apply the pause pattern. Then **S9** covers advanced types and gas optimization.
