# S9 — Advanced Types & Gas Optimization

## What Problem Are We Solving?

Every operation on the EVM costs gas. Gas is paid in ETH. Bad code means users pay more per transaction — and in a competitive protocol, that directly drives users away. This lesson covers:
1. Advanced Solidity types you'll encounter in real contracts
2. How the EVM charges for storage and computation
3. Concrete patterns to write cheaper code

---

## 1. Function Types

Functions are first-class values in Solidity. You can store a function in a variable and call it later.

```solidity
// Function type syntax: function(param types) visibility returns (return types)
function(uint256, uint256) pure returns (uint256) public operation;

function add(uint256 a, uint256 b) public pure returns (uint256) { return a + b; }
function mul(uint256 a, uint256 b) public pure returns (uint256) { return a * b; }

// Assign and call
operation = add;
operation(3, 4); // returns 7

operation = mul;
operation(3, 4); // returns 12
```

**Internal vs external function types:**

```solidity
function(uint256) internal pure returns (uint256) internalFn;
function(uint256) external returns (uint256) externalFn;
```

Internal function types are used within the same contract or library. External function types hold a contract address + function selector — used for callbacks.

**Real use case — strategy pattern:**

```solidity
contract Executor {
    function execute(
        uint256[] memory data,
        function(uint256) pure returns (uint256) transform
    ) public pure returns (uint256[] memory) {
        uint256[] memory result = new uint256[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            result[i] = transform(data[i]);
        }
        return result;
    }
}
```

---

## 2. Custom Types (User-Defined Value Types)

Introduced in Solidity 0.8.8. Lets you wrap a primitive in a named type for type safety.

```solidity
type Price is uint256;
type Quantity is uint256;

// Now these are distinct types — compiler catches mixups
Price p = Price.wrap(100);
Quantity q = Quantity.wrap(5);

// p + q would be a compile error — different types
// To get the underlying value:
uint256 raw = Price.unwrap(p);
```

**Why use this?** Prevents passing a `Price` where a `Quantity` is expected — a bug that happens constantly with raw `uint256` everywhere.

---

## 3. Storage Layout — The Most Important Gas Concept

Storage is the most expensive thing in Solidity. Understanding how it works is essential.

### Slot basics

- Storage is a mapping of `uint256 slot → uint256 value` (32 bytes per slot)
- State variables are assigned slots sequentially starting at slot 0
- Each slot costs **20,000 gas to write for the first time (SSTORE cold)**, **2,900 gas to update (SSTORE warm)**
- Reads cost **2,100 gas cold**, **100 gas warm**

```solidity
contract Example {
    uint256 a;  // slot 0
    uint256 b;  // slot 1
    uint256 c;  // slot 2
}
```

### Variable packing

Multiple small variables can share a single 32-byte slot if they fit:

```solidity
// Bad — 3 slots used (each uint256 fills a whole slot)
contract Unpacked {
    uint256 a;   // slot 0 (32 bytes)
    uint256 b;   // slot 1 (32 bytes)
    uint256 c;   // slot 2 (32 bytes)
}

// Good — 1 slot used (8 + 8 + 8 = 24 bytes, fits in 32)
contract Packed {
    uint64 a;    // slot 0: bytes 0–7
    uint64 b;    // slot 0: bytes 8–15
    uint64 c;    // slot 0: bytes 16–23
}
```

**Order matters:** Variables pack sequentially. If you break the sequence, you waste slots:

```solidity
// Bad — 3 slots (uint128 can't share with uint256)
uint128 a;   // slot 0 (16 bytes used, 16 wasted)
uint256 b;   // slot 1 (full slot)
uint128 c;   // slot 2 (16 bytes used, 16 wasted)

// Good — 2 slots
uint128 a;   // slot 0: bytes 0–15
uint128 c;   // slot 0: bytes 16–31
uint256 b;   // slot 1 (full slot)
```

**Rule:** Group small variables together. Put `uint256` / `address` (20 bytes) last or separate.

### Mappings and dynamic arrays

- Mappings don't pack — each value is stored at `keccak256(key . slot)`
- Dynamic arrays store their length at the base slot, elements at `keccak256(slot) + index`

---

## 4. Memory vs Storage vs Calldata

Where data lives determines how much it costs to use it.

| Location | Persists | Cost | Use for |
|----------|----------|------|---------|
| `storage` | Forever (on-chain) | Expensive | State variables |
| `memory` | Current call only | Cheap (linear) | Temporary values, return data |
| `calldata` | Current call only | Cheapest | External function input params |

```solidity
// Calldata — read-only, gas cheaper than memory for external functions
function processArray(uint256[] calldata data) external pure returns (uint256) {
    // data is read directly from calldata, no copy
}

// Memory — writable but costs more (data is copied)
function processArray(uint256[] memory data) public pure returns (uint256) {
    data[0] = 99; // allowed — memory is mutable
}
```

**Rule:** For external function parameters you don't modify, always use `calldata` over `memory`.

---

## 5. Caching Storage in Memory

Every storage read (`SLOAD`) costs gas. If you read the same storage variable multiple times, cache it in a local variable:

```solidity
// Bad — 3 SLOADs
function bad() external view returns (uint256) {
    return balances[msg.sender] + balances[msg.sender] + balances[msg.sender];
}

// Good — 1 SLOAD, 2 cheap memory reads
function good() external view returns (uint256) {
    uint256 bal = balances[msg.sender]; // one SLOAD
    return bal + bal + bal;
}
```

Same applies to state variables:

```solidity
// Bad
function loop() external {
    for (uint256 i = 0; i < items.length; i++) { // items.length read every iteration
        // ...
    }
}

// Good
function loop() external {
    uint256 len = items.length; // cache once
    for (uint256 i = 0; i < len; i++) {
        // ...
    }
}
```

---

## 6. `uint256` vs Smaller Uints

Counter-intuitive: **smaller uints are not always cheaper.**

The EVM operates on 32-byte words. Using `uint8` or `uint128` inside a function requires masking operations to truncate to the smaller size — which costs extra gas compared to `uint256`.

```solidity
// uint8 loop counter — extra masking operations each iteration
for (uint8 i = 0; i < 10; i++) { ... }

// uint256 loop counter — native EVM word size, no masking
for (uint256 i = 0; i < 10; i++) { ... }
```

**Rule:**
- Use `uint256` for local variables and function parameters
- Use smaller uints (`uint64`, `uint128`) only in storage structs/state variables for packing

---

## 7. `++i` vs `i++`

`i++` stores the old value before incrementing (costs a temporary). `++i` increments in place.

```solidity
// i++ — reads i, stores copy, increments, returns copy (extra operation)
for (uint256 i = 0; i < len; i++) { ... }

// ++i — increments and returns new value (cheaper)
for (uint256 i = 0; i < len; ++i) { ... }
```

Small saving per iteration, but matters in loops that run thousands of times.

---

## 8. Errors: Custom vs Revert Strings

You already know this from S8, but the gas reason:

```solidity
// revert string — ABI-encodes the string at runtime, expensive
require(condition, "This is an error message"); // ~50+ gas for encoding

// custom error — just a 4-byte selector, no encoding
error MyError();
if (!condition) revert MyError(); // ~4 bytes, much cheaper
```

**Always use custom errors.**

---

## 9. Short-Circuit Evaluation

Solidity uses short-circuit evaluation for `&&` and `||`. Put the cheapest check first:

```solidity
// Bad — expensive storage read happens even if cheap check would have failed
if (expensiveStorageRead() && msg.value > 0) { ... }

// Good — cheap check first, expensive read only if needed
if (msg.value > 0 && expensiveStorageRead()) { ... }
```

Same applies to modifiers on functions — put the cheapest modifier first.

---

## 10. Immutable and Constant

Variables that don't change should be marked `constant` or `immutable` — they're stored in bytecode, not storage, so reads are free (no SLOAD).

```solidity
// constant — value known at compile time, stored in bytecode
uint256 public constant MAX_SUPPLY = 1_000_000;

// immutable — value set once in constructor, stored in bytecode
address public immutable owner;
constructor() {
    owner = msg.sender;
}
```

**Rule:** If a value never changes after deployment, it should be `immutable` or `constant`.

---

## 11. Events vs Storage for Historical Data

Storing historical data (e.g., a log of all deposits) on-chain is extremely expensive. Events are a much cheaper alternative:

```solidity
// Bad — array grows forever, every push costs ~20k gas
uint256[] public depositHistory;

function deposit() external payable {
    depositHistory.push(msg.value); // expensive
}

// Good — emit an event (costs ~375 gas for LOG opcode + data)
event Deposited(address indexed user, uint256 amount);

function deposit() external payable {
    emit Deposited(msg.sender, msg.value); // cheap
}
```

Trade-off: events are not readable from on-chain code — only off-chain indexers can query them. If you need historical data in a contract function, you must store it.

---

## 12. Inline Assembly (Basics)

Solidity compiles to EVM bytecode. You can drop into raw EVM assembly using `assembly {}` blocks when you need maximum control:

```solidity
function efficientAdd(uint256 a, uint256 b) public pure returns (uint256 result) {
    assembly {
        result := add(a, b)
    }
}
```

Assembly bypasses Solidity's safety checks — no overflow protection, no type checking. Used in:
- Gas-critical paths (e.g., token transfer in ERC-20)
- Low-level bit manipulation
- Calling conventions that Solidity doesn't expose

You won't write assembly often, but you'll read it in OpenZeppelin and other production contracts. For now, knowing it exists and why it's used is enough.

---

## Summary

| Pattern | What it saves |
|---------|--------------|
| Pack storage variables | Fewer slots = fewer SSTOREs |
| Cache storage in memory | Fewer SLOADs per read |
| `calldata` over `memory` | No copy cost for input params |
| `uint256` for locals | No masking overhead |
| `++i` over `i++` | One less operation per iteration |
| Custom errors | No runtime string encoding |
| Short-circuit order | Skip expensive checks when possible |
| `constant`/`immutable` | Storage reads become free |
| Events over storage arrays | ~50x cheaper for append-only logs |

---

## What's Next

**P-S9** — Practice set: you'll rewrite gas-heavy contracts into cheaper versions, measure the impact of packing decisions, and apply the patterns above. Then **S10** covers security patterns (CEI, reentrancy, safe math).
