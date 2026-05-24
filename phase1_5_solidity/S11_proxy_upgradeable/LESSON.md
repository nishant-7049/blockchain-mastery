# S11 — Proxy & Upgradeable Contracts

## Why This Exists

Smart contracts are immutable once deployed. If you find a bug, you can't fix it. If you want a new feature, you can't add it. For simple contracts this is fine — immutability is a feature. But for large protocols managing millions of dollars, you need the ability to fix critical bugs.

The solution: separate **storage** from **logic**.

---

## 1. The Core Idea — delegatecall

Everything in proxy patterns is built on one EVM opcode: `delegatecall`.

Normal `call`:
- Contract A calls Contract B
- B's code runs in B's context (B's storage, B's `address(this)`)

`delegatecall`:
- Contract A calls Contract B
- B's code runs in **A's context** (A's storage, A's `address(this)`)

```solidity
contract A {
    uint256 public value; // slot 0

    function callB(address b) external {
        // normal call — changes B's storage
        b.call(abi.encodeWithSignature("setValue(uint256)", 42));

        // delegatecall — changes A's storage using B's logic
        b.delegatecall(abi.encodeWithSignature("setValue(uint256)", 42));
    }
}

contract B {
    uint256 public value; // slot 0

    function setValue(uint256 v) external {
        value = v; // with delegatecall, this writes to slot 0 of whoever called
    }
}
```

This is the key: `delegatecall` borrows B's logic but executes it against A's storage.

---

## 2. The Proxy Pattern

```
User → Proxy (stores state) → Implementation (has logic)
         ↑                           ↑
    never changes              can be swapped
```

The Proxy contract:
- Holds all the state (balances, owner, etc.)
- Has no real logic — just forwards every call to Implementation via `delegatecall`
- Never changes address (users always interact with Proxy)

The Implementation contract:
- Has all the logic (deposit, withdraw, etc.)
- Holds no state — just code
- Can be replaced with a new version

To upgrade: deploy a new Implementation, point Proxy at it. All state is preserved in Proxy. Users don't change their contract address.

### The fallback function — how forwarding works

```solidity
contract Proxy {
    address public implementation;

    constructor(address _impl) {
        implementation = _impl;
    }

    fallback() external payable {
        address impl = implementation;
        assembly {
            // copy calldata to memory
            calldatacopy(0, 0, calldatasize())
            // delegatecall to implementation
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            // copy return data
            returndatacopy(0, 0, returndatasize())
            // return or revert
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
```

Every call to the Proxy that doesn't match a function hits `fallback()`, which delegates to Implementation. The user thinks they're talking to one contract — they're actually using Proxy's storage with Implementation's logic.

---

## 3. The Storage Collision Problem

This is the most dangerous pitfall in proxy patterns.

Both Proxy and Implementation use storage slots. If both declare variables, they must not overlap:

```solidity
contract Proxy {
    address public implementation; // slot 0
}

contract ImplementationV1 {
    address public owner; // slot 0 ← COLLISION
    uint256 public value; // slot 1
}
```

When Implementation writes `owner`, it writes to slot 0 — which is where Proxy stores `implementation`. One write corrupts the other.

**Fix 1 — EIP-1967 Storage Slots**

Store proxy admin data at pseudo-random slots using keccak256:

```solidity
// Implementation address stored at this specific slot
bytes32 constant IMPL_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
```

These slots are so far from slot 0 that no normal contract variable will ever land there. OpenZeppelin's proxies all use this approach.

**Fix 2 — Initializers instead of constructors**

Constructors run in the Implementation's context, not Proxy's. So constructor code never runs when Proxy delegates to Implementation. You must replace constructors with `initialize()` functions:

```solidity
// ❌ Constructor — only runs when Implementation is deployed, not in Proxy's context
contract TokenV1 {
    address public owner;
    constructor() {
        owner = msg.sender; // sets Implementation's owner, not Proxy's
    }
}

// ✅ Initializer — called once through Proxy, runs in Proxy's context
contract TokenV1 {
    address public owner;
    bool private initialized;

    function initialize(address _owner) external {
        require(!initialized, "Already initialized");
        initialized = true;
        owner = _owner;
    }
}
```

---

## 4. Transparent Proxy vs UUPS

Two main proxy patterns in production:

### Transparent Proxy

The Proxy itself handles upgrade logic. A `ProxyAdmin` contract controls who can upgrade.

```
User calls  →  Proxy checks: is caller admin?
                 YES → handle upgrade functions (upgradeTo, changeAdmin)
                 NO  → delegate to Implementation
```

- Proxy is heavier (upgrade logic lives there)
- Clear separation: admin upgrades, users use the contract
- More gas on every call (admin check)
- Used by: early OpenZeppelin proxies

### UUPS (Universal Upgradeable Proxy Standard — EIP-1822)

Upgrade logic lives in the **Implementation**, not the Proxy. Proxy is minimal.

```
User calls → Proxy (minimal, no admin logic) → delegates everything to Implementation
                                                 Implementation has upgradeTo() function
```

- Proxy is very lightweight — just the fallback
- Upgrade logic in Implementation — can be removed in a future version
- Slightly cheaper per call
- Risk: if you deploy an Implementation without `upgradeTo`, you lose upgradeability forever
- Used by: modern OpenZeppelin, most new protocols

### Which to use?

| | Transparent | UUPS |
|--|------------|------|
| Upgrade logic | In Proxy | In Implementation |
| Gas per call | Slightly more | Less |
| Risk | Lower | Higher (can brick upgradeability) |
| OZ support | `TransparentUpgradeableProxy` | `UUPSUpgradeable` |

**Default to UUPS** for new projects — lighter and more flexible.

---

## 5. OpenZeppelin Upgradeable Contracts

OZ provides a full suite of upgradeable base contracts. The pattern:

```solidity
// Normal OZ contract
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Upgradeable version — suffix is "Upgradeable"
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract MyTokenV1 is ERC20Upgradeable, UUPSUpgradeable, OwnableUpgradeable {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // prevents initialize() from being called on implementation directly
    }

    function initialize(string memory name, string memory symbol) public initializer {
        __ERC20_init(name, symbol);        // replaces ERC20 constructor
        __Ownable_init(msg.sender);        // replaces Ownable constructor
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

Key points:
- `initializer` modifier (from OZ) replaces constructor, ensures it's only called once
- `__ContractName_init()` functions replace constructors of parent contracts
- `_authorizeUpgrade()` controls who can upgrade — put access control here
- `_disableInitializers()` in constructor prevents direct initialization of the implementation

---

## 6. Storage Layout — Must Never Change

When upgrading, you can only **add** new storage variables at the end. Never remove or reorder:

```solidity
// V1
contract TokenV1 {
    address public owner;   // slot 0
    uint256 public supply;  // slot 1
}

// V2 — correct upgrade
contract TokenV2 {
    address public owner;   // slot 0 — unchanged
    uint256 public supply;  // slot 1 — unchanged
    uint256 public maxCap;  // slot 2 — new variable added at end ✅
}

// V2 — WRONG — breaks everything
contract TokenV2_Bad {
    uint256 public maxCap;  // slot 0 — was owner! now corrupted ❌
    address public owner;   // slot 1 — was supply! now corrupted ❌
    uint256 public supply;  // slot 2
}
```

The Proxy's storage slots don't know variable names — just positions. Reordering maps the wrong data to the wrong variable.

OZ has a plugin (`@openzeppelin/hardhat-upgrades`) that validates storage layout compatibility automatically before deploying an upgrade.

---

## Summary

| Concept | What it means |
|---------|--------------|
| `delegatecall` | Run external code in your own storage context |
| Proxy | Holds state, forwards all calls to Implementation |
| Implementation | Holds logic, no state, can be replaced |
| EIP-1967 | Stores proxy metadata at random slots to avoid collision |
| Initializer | Replaces constructor — runs through Proxy |
| Transparent Proxy | Upgrade logic in Proxy |
| UUPS | Upgrade logic in Implementation — lighter |
| Storage layout | Never remove/reorder variables between upgrades |

---

## What's Next

No practice set for S11 — you'll apply proxy patterns directly when building contracts in the C-series. **C1** starts now: Counter contract with LLD first, then code, then tests.
