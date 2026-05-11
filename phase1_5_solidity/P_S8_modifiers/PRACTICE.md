# P-S8 — Modifiers & Access Control Practice Set

Work through each exercise in order. Write your solutions in `solutions.sol`.
Exercises escalate from isolated modifier syntax → full access-controlled systems.

---

## Exercise 1 — Basic Modifier (Warm-up)

Write a contract `Counter` with:
- A `uint256 public count` state variable
- A state variable that stores the owner (set in constructor)
- A modifier `onlyOwner` that reverts with `"Not owner"` if caller is not owner
- A function `increment()` protected by `onlyOwner` that adds 1 to `count`
- A function `reset()` protected by `onlyOwner` that sets `count` to 0

---

## Exercise 2 — Modifier With Parameter

Write a contract `AgeGated` with:
- A mapping `mapping(address => uint256) public ages`
- A function `setAge(address user, uint256 age)` that sets age (no restriction)
- A modifier `minAge(uint256 required)` that reverts with `"Too young"` if `ages[msg.sender] < required`
- A function `buyAlcohol()` that uses `minAge(18)` — just emit an event `Purchased("alcohol")`
- A function `rentCar()` that uses `minAge(21)` — just emit an event `Purchased("car")`

---

## Exercise 3 — Post-Condition Modifier

Write a contract `SafeVault` with:
- A `bool private locked` state variable
- A modifier `noReentrancy` that:
  - Requires `locked` is false (revert: `"Reentrant call"`)
  - Sets `locked = true`
  - Runs the function body (`_;`)
  - Sets `locked = false` after
- A function `withdraw(uint256 amount)` protected by `noReentrancy` that sends ETH to `msg.sender`
- A `receive()` function so the contract can receive ETH

---

## Exercise 4 — Chained Modifiers

Write a contract `AdminPanel` with:
- `address public owner` set in constructor
- `bool public paused` (default false)
- Modifier `onlyOwner` — reverts `"Not owner"`
- Modifier `whenNotPaused` — reverts `"Paused"`
- Function `pause()` — `onlyOwner`, sets `paused = true`, emits `Paused()`
- Function `unpause()` — `onlyOwner`, sets `paused = false`, emits `Unpaused()`
- Function `doWork()` — requires BOTH `onlyOwner` AND `whenNotPaused` — just emits `WorkDone()`

**Question:** In `doWork()`, which modifier runs first? Does the order matter here?

---

## Exercise 5 — Ownership Transfer (Safe Version)

Write a contract `SafeOwnable` with:
- `address public owner`
- `address public pendingOwner`
- Modifier `onlyOwner`
- `constructor()` — sets `owner = msg.sender`
- `transferOwnership(address newOwner)` — `onlyOwner`, requires newOwner != address(0) (revert: `"Zero address"`), sets `pendingOwner = newOwner`, emits `OwnershipTransferStarted(owner, newOwner)`
- `acceptOwnership()` — requires `msg.sender == pendingOwner` (revert: `"Not pending owner"`), sets `owner = pendingOwner`, clears `pendingOwner = address(0)`, emits `OwnershipTransferred(old, new)`
- `renounceOwnership()` — `onlyOwner`, sets `owner = address(0)`, emits `OwnershipTransferred(old, address(0))`

---

## Exercise 6 — Manual RBAC System

Write a contract `RBACVault` with:

**Roles (as `bytes32` constants):**
- `ADMIN_ROLE = keccak256("ADMIN_ROLE")`
- `DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE")`
- `WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE")`

**State:**
- `mapping(bytes32 => mapping(address => bool)) public roles`

**Modifier:**
- `onlyRole(bytes32 role)` — reverts `"Missing role"`

**Constructor:**
- Grant `ADMIN_ROLE` to deployer
- Grant `DEPOSITOR_ROLE` to deployer
- Grant `WITHDRAWER_ROLE` to deployer

**Functions:**
- `grantRole(bytes32 role, address account)` — `onlyRole(ADMIN_ROLE)`, sets mapping to true, emits `RoleGranted(role, account)`
- `revokeRole(bytes32 role, address account)` — `onlyRole(ADMIN_ROLE)`, sets mapping to false, emits `RoleRevoked(role, account)`
- `deposit()` — `payable`, `onlyRole(DEPOSITOR_ROLE)`, emits `Deposited(msg.sender, msg.value)`
- `withdraw(uint256 amount)` — `onlyRole(WITHDRAWER_ROLE)`, sends ETH to `msg.sender`, emits `Withdrawn(msg.sender, amount)`
- `receive()` — so the contract can receive ETH directly

**Question:** Why use `keccak256("ADMIN_ROLE")` instead of just `uint8 constant ADMIN_ROLE = 0`?

---

## Exercise 7 — Full Access-Controlled Token (Boss Exercise)

Write a contract `ManagedToken` that implements a basic token with full access control.

**Roles:**
- `MINTER_ROLE = keccak256("MINTER_ROLE")`
- `BURNER_ROLE = keccak256("BURNER_ROLE")`
- `PAUSER_ROLE = keccak256("PAUSER_ROLE")`

**State:**
- `address public admin`
- `mapping(bytes32 => mapping(address => bool)) public roles`
- `mapping(address => uint256) public balances`
- `uint256 public totalSupply`
- `bool public paused`

**Modifiers:**
- `onlyAdmin`
- `onlyRole(bytes32 role)`
- `whenNotPaused`

**Constructor:**
- Set `admin = msg.sender`
- Grant all four roles (MINTER, BURNER, PAUSER) to deployer

**Functions:**
- `grantRole(bytes32 role, address account)` — `onlyAdmin`
- `revokeRole(bytes32 role, address account)` — `onlyAdmin`
- `pause()` — `onlyRole(PAUSER_ROLE)`, sets `paused = true`, emits `Paused(msg.sender)`
- `unpause()` — `onlyRole(PAUSER_ROLE)`, sets `paused = false`, emits `Unpaused(msg.sender)`
- `mint(address to, uint256 amount)` — `onlyRole(MINTER_ROLE)` + `whenNotPaused`, increases `balances[to]` and `totalSupply`, emits `Transfer(address(0), to, amount)`
- `burn(address from, uint256 amount)` — `onlyRole(BURNER_ROLE)` + `whenNotPaused`, requires `balances[from] >= amount` (revert: `"Insufficient balance"`), decreases `balances[from]` and `totalSupply`, emits `Transfer(from, address(0), amount)`
- `transfer(address to, uint256 amount)` — `whenNotPaused`, requires `balances[msg.sender] >= amount`, moves balance, emits `Transfer(msg.sender, to, amount)`

---

## Thinking Questions

Answer these in a comment block at the top of your `solutions.sol`:

1. What is `_;` and what happens if you forget it in a modifier?
2. A modifier has code both before and after `_;`. What real-world pattern does this enable?
3. Why is `tx.origin` dangerous for access control? Give a concrete attack scenario.
4. What's the risk of a single-step `transferOwnership`? How does two-step fix it?
5. In Exercise 7, why is `whenNotPaused` applied to `mint` and `burn` but you might also want to consider applying it to `transfer`? What's the design tradeoff?
