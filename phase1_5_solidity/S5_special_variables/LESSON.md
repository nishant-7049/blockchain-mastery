# S5 — Special Variables

> Covers: msg.sender, msg.value, block.timestamp, tx.origin, address(this), and more

---

## 1. What Are Special Variables?

Special variables are globally available in every Solidity function — you don't declare them, they're injected by the EVM at runtime. They give you context about the current transaction, block, and contract.

Three categories:
- **`msg.*`** — about the current call
- **`block.*`** — about the current block
- **`tx.*`** — about the originating transaction

---

## 2. msg — The Current Call

### `msg.sender` — `address`
The address that directly called the current function.

```solidity
function deposit() external {
    balances[msg.sender] += 1; // whoever called this function
}
```

Changes with every external call. If UserA calls ContractA which calls ContractB:
- Inside ContractA: `msg.sender` = UserA
- Inside ContractB: `msg.sender` = ContractA

### `msg.value` — `uint256`
Amount of ETH (in wei) sent with the current call. Only non-zero in `payable` functions.

```solidity
function fund() external payable {
    require(msg.value >= 0.01 ether, "minimum 0.01 ETH");
    balances[msg.sender] += msg.value;
}
```

In a non-payable function, `msg.value` is always 0. The EVM enforces this — sending ETH to a non-payable function reverts automatically.

### `msg.data` — `bytes calldata`
The raw calldata of the transaction — function selector (first 4 bytes) + encoded arguments.

```solidity
// rarely used directly, but available
bytes memory data = msg.data;
```

Used in advanced patterns like proxy contracts and low-level calls.

### `msg.sig` — `bytes4`
The first 4 bytes of `msg.data` — the function selector.

```solidity
bytes4 selector = msg.sig; // e.g. 0xa9059cbb for transfer(address,uint256)
```

---

## 3. block — The Current Block

### `block.timestamp` — `uint256`
Unix timestamp of when the current block was mined (seconds since Jan 1, 1970).

```solidity
uint256 public deployedAt;

constructor() {
    deployedAt = block.timestamp;
}

function hasExpired(uint256 duration) public view returns (bool) {
    return block.timestamp >= deployedAt + duration;
}
```

**Warning:** Validators can manipulate `block.timestamp` slightly — typically within ~15 seconds. Never use it for:
- Randomness (predictable/manipulable)
- Precise timing under 15 seconds

Safe for: rough time windows (hours, days), expiry checks, cooldown periods.

### `block.number` — `uint256`
The current block's height (how many blocks since genesis).

```solidity
uint256 public createdAtBlock = block.number;

// check how many blocks have passed
uint256 blocksPassed = block.number - createdAtBlock;
```

On Ethereum, ~1 block per 12 seconds. Used for time estimation when you need manipulation-resistant timing.

### `block.prevrandao` — `uint256`
The previous block's randomness beacon (replaces `block.difficulty` after the Merge). Slightly better than `block.timestamp` for randomness but still manipulable by validators — never use for high-stakes randomness (lotteries, NFT reveals). Use Chainlink VRF instead.

### `block.basefee` — `uint256`
The base fee of the current block in wei (EIP-1559). Changes dynamically based on network congestion.

### `block.coinbase` — `address payable`
The address of the validator who produced this block. Rarely used in normal contracts.

---

## 4. tx — The Original Transaction

### `tx.origin` — `address`
The original EOA that initiated the entire transaction chain. Never changes regardless of how many contracts are called.

```solidity
// UserA → ContractA → ContractB
// Inside ContractB:
tx.origin  // = UserA (original signer, always)
msg.sender // = ContractA (direct caller)
```

**Never use `tx.origin` for authentication:**

```solidity
// VULNERABLE — phishing attack possible
function withdraw() external {
    require(tx.origin == owner, "not owner");
    // attacker tricks owner into calling malicious contract
    // malicious contract calls this — tx.origin is still owner ✅ passes
    payable(tx.origin).transfer(address(this).balance);
}

// SAFE
function withdraw() external {
    require(msg.sender == owner, "not owner");
    // attacker's contract calls this — msg.sender is attacker's contract ❌ fails
}
```

`tx.origin` is only safe for: checking that the caller is NOT a contract (but even this has edge cases).

### `tx.gasprice` — `uint256`
The gas price the sender set for this transaction (in wei per gas unit).

---

## 5. address — The Contract Itself

### `address(this)` — `address`
The address of the current contract.

```solidity
function getMyAddress() external view returns (address) {
    return address(this);
}
```

### `address(this).balance` — `uint256`
How much ETH the current contract holds (in wei).

```solidity
function getContractBalance() external view returns (uint256) {
    return address(this).balance;
}
```

### `address(this).code` — `bytes memory`
The bytecode of the contract. Used in advanced checks (e.g. checking if an address is a contract).

---

## 6. Other Useful Globals

### `gasleft()` — `uint256`
Remaining gas in the current call. Decreases as execution continues.

```solidity
function gasCheck() external view returns (uint256) {
    return gasleft(); // how much gas is left right now
}
```

Used in loops with gas limits or proxy patterns.

### `block.chainid` — `uint256`
The chain ID of the network. Ethereum mainnet = 1, Sepolia = 11155111, Polygon = 137.

```solidity
require(block.chainid == 1, "mainnet only");
```

Used to prevent replay attacks across chains (alongside EIP-155 which you learned in Phase 1).

---

## 7. The Phishing Attack — tx.origin Deep Dive

This is worth understanding in full because it trips up many developers.

```
Normal flow:
UserA ──calls──► VictimContract.withdraw()
                 tx.origin = UserA ✅
                 msg.sender = UserA ✅

Attack flow:
UserA ──calls──► MaliciousContract.attack()
                     └──calls──► VictimContract.withdraw()
                                  tx.origin = UserA ✅ (still passes!)
                                  msg.sender = MaliciousContract ❌
```

The attacker deploys `MaliciousContract` and tricks the owner into calling it (fake airdrop, fake game, etc.). If `VictimContract` uses `tx.origin` for auth, the attack succeeds. If it uses `msg.sender`, it fails because `msg.sender` would be `MaliciousContract`, not the owner.

**Rule:** Always use `msg.sender` for access control. `tx.origin` is almost always wrong.

---

## 8. Putting It Together — Time-Locked Vault

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error NotOwner();
error TooEarly(uint256 releaseTime, uint256 currentTime);
error NothingToWithdraw();
error TransferFailed();

contract TimeLock {
    address public immutable owner;
    uint256 public immutable releaseTime;
    uint256 public balance;

    constructor(uint256 lockDuration) payable {
        owner = msg.sender;
        releaseTime = block.timestamp + lockDuration;
        balance = msg.value;
    }

    function deposit() external payable {
        if(msg.sender != owner) revert NotOwner();
        balance += msg.value;
    }

    function withdraw() external {
        if(msg.sender != owner) revert NotOwner();
        if(block.timestamp < releaseTime) revert TooEarly(releaseTime, block.timestamp);
        if(balance == 0) revert NothingToWithdraw();

        uint256 amount = balance;
        balance = 0;                                          // CEI
        (bool ok, ) = payable(owner).call{value: amount}("");
        if(!ok) revert TransferFailed();
    }

    function timeRemaining() external view returns (uint256) {
        if(block.timestamp >= releaseTime) return 0;
        return releaseTime - block.timestamp;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance; // actual ETH held
    }
}
```

Special variables used:
- `msg.sender` — access control
- `msg.value` — ETH sent to constructor and deposit
- `block.timestamp` — time lock enforcement
- `address(this).balance` — contract's actual ETH balance

---

## Summary

| Variable | Type | What it is |
|----------|------|------------|
| `msg.sender` | `address` | Direct caller of current function |
| `msg.value` | `uint256` | ETH sent with current call (wei) |
| `msg.data` | `bytes calldata` | Raw calldata |
| `msg.sig` | `bytes4` | Function selector (first 4 bytes) |
| `block.timestamp` | `uint256` | Current block time (unix seconds) |
| `block.number` | `uint256` | Current block height |
| `block.chainid` | `uint256` | Chain ID (1 = mainnet) |
| `block.basefee` | `uint256` | Base fee in wei (EIP-1559) |
| `block.coinbase` | `address` | Validator address |
| `tx.origin` | `address` | Original EOA, never use for auth |
| `tx.gasprice` | `uint256` | Gas price set by sender |
| `address(this)` | `address` | This contract's address |
| `address(this).balance` | `uint256` | ETH held by this contract |
| `gasleft()` | `uint256` | Remaining gas |

---

→ **Practice Set P-S5** — Special variables exercises
→ After that: **S6: ETH Handling**
