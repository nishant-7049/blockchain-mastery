# S10 — Security Patterns

## What Problem Are We Solving?

Smart contracts are immutable once deployed and hold real money. There is no "undo." A single vulnerability can drain millions of dollars in one transaction — and it has, repeatedly. This lesson covers the most critical attack patterns and the defensive techniques that stop them.

---

## 1. Reentrancy — The Most Famous Exploit

### How it works

Reentrancy happens when your contract calls an external address, and that external address calls back into your contract before the first call finishes.

```solidity
// Vulnerable contract
contract Vault {
    mapping(address => uint256) public balances;

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        // Step 1: Send ETH to caller
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);

        // Step 2: Update balance — TOO LATE
        balances[msg.sender] = 0;
    }
}
```

```solidity
// Attacker contract
contract Attacker {
    Vault vault;

    function attack() external payable {
        vault.deposit{value: 1 ether}();
        vault.withdraw();
    }

    // Called automatically when Vault sends ETH
    receive() external payable {
        if (address(vault).balance >= 1 ether) {
            vault.withdraw(); // calls withdraw AGAIN before balances[msg.sender] = 0
        }
    }
}
```

The attack loop:
1. Attacker calls `withdraw()`
2. Vault reads `balances[attacker] = 1 ether` — still set
3. Vault sends 1 ETH to attacker
4. Attacker's `receive()` fires — calls `withdraw()` again
5. Vault reads `balances[attacker] = 1 ether` — STILL set (never cleared)
6. Sends another 1 ETH
7. Repeats until Vault is empty

This is how $60M was stolen from The DAO in 2016.

---

## 2. The CEI Pattern — Primary Defense

**Checks-Effects-Interactions** is the most important rule in Solidity.

- **Checks** — validate conditions (require, revert)
- **Effects** — update your own state
- **Interactions** — call external contracts or send ETH

Always in that order. Never interact before updating state.

```solidity
// ✅ CEI applied
function withdraw() external {
    // CHECKS
    uint256 amount = balances[msg.sender];
    require(amount > 0);

    // EFFECTS — state updated BEFORE external call
    balances[msg.sender] = 0;

    // INTERACTIONS — external call happens last
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
}
```

Now if the attacker reenters:
1. `balances[msg.sender]` was already set to 0 in Effects
2. On reentry, `amount = balances[msg.sender] = 0`
3. `require(amount > 0)` fails — attack stopped

---

## 3. Reentrancy Guard — Belt and Suspenders

CEI is the primary defense. A reentrancy guard is a secondary lock. Use both.

```solidity
contract ReentrancyGuard {
    bool private locked;

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
}

contract SafeVault is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0);

        balances[msg.sender] = 0;  // CEI still applied
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
    }
}
```

If reentrancy is attempted:
- `locked` is `true` when the reentrant call arrives
- `require(!locked)` fails immediately

OpenZeppelin's `ReentrancyGuard` uses a `uint256` instead of `bool` for the lock — slightly cheaper because updating `bool` to `bool` still costs an SSTORE:

```solidity
uint256 private constant NOT_ENTERED = 1;
uint256 private constant ENTERED = 2;
uint256 private _status = NOT_ENTERED;
// Changing 1→2→1 is cheaper than false→true→false
```

---

## 4. Read-Only Reentrancy

A subtler attack: your contract's state is mid-update when an external contract reads it. The reader gets stale/inconsistent data and acts on it.

```solidity
contract PriceOracle {
    Vault vault;

    function getPrice() external view returns (uint256) {
        // reads vault.totalSupply() — but vault might be mid-withdraw
        return vault.totalSupply();
    }
}
```

If `vault.totalSupply()` is read during a reentrancy attack before the supply is updated, the oracle returns wrong data. Protocols depending on this price can be exploited.

Defense: apply `nonReentrant` to view functions that read critical state too, or use the OZ `ReentrancyGuardTransient` in newer code.

---

## 5. Integer Overflow and Underflow

Before Solidity 0.8, arithmetic silently wrapped around:

```solidity
// Solidity 0.7 and below
uint256 x = 0;
x - 1; // = 2^256 - 1 (wraps around silently)

uint8 y = 255;
y + 1; // = 0 (wraps around silently)
```

This was exploited in multiple token contracts — attackers would set their balance to a huge number by underflowing from 0.

### Solidity 0.8+ — Built-in protection

From 0.8 onwards, overflow and underflow revert automatically:

```solidity
// Solidity 0.8+
uint256 x = 0;
x - 1; // reverts with panic error
```

You no longer need SafeMath libraries. Just use `^0.8.0` and arithmetic is safe by default.

### `unchecked` — When to opt out

The overflow check costs a small amount of gas. In loops where you've already proven the value can't overflow, you can skip it:

```solidity
// Safe to use unchecked — i can never overflow before reaching len
for (uint256 i = 0; i < len;) {
    // ... loop body
    unchecked { ++i; }
}
```

Only use `unchecked` when you are mathematically certain overflow is impossible. Never use it on user-supplied values.

---

## 6. Denial of Service (DoS)

### DoS via unbounded loop

```solidity
// Vulnerable — array grows forever, eventually loop costs too much gas
address[] public users;

function payAll() external {
    for (uint256 i = 0; i < users.length; ++i) {
        payable(users[i]).transfer(shares[users[i]]);
    }
}
```

If `users` has 10,000 entries, `payAll` will hit the block gas limit and revert. Nobody gets paid.

**Fix — pull over push:**

```solidity
// Users pull their own payment instead of contract pushing to all
mapping(address => uint256) public pendingPayments;

function claimPayment() external {
    uint256 amount = pendingPayments[msg.sender];
    require(amount > 0);
    pendingPayments[msg.sender] = 0;
    payable(msg.sender).call{value: amount}("");
}
```

Each user pays their own gas. One failed transfer doesn't block everyone else.

### DoS via failed external call

```solidity
// Vulnerable — one bad recipient blocks the loop
function distributeRewards() external {
    for (uint256 i = 0; i < recipients.length; ++i) {
        // If one recipient is a contract that reverts on receive, whole loop reverts
        payable(recipients[i]).transfer(reward);
    }
}
```

**Fix:** Use pull payments. Or use `.call` and handle failure gracefully without reverting the whole loop.

---

## 7. Force-Feeding ETH

Contracts can receive ETH even without a `receive()` or `payable` function through:
- `selfdestruct(targetAddress)` — sends ETH directly, bypassing all code
- Coinbase/block reward — validators can send ETH to any address

This breaks any logic that assumes `address(this).balance == 0` or relies on exact balance checks:

```solidity
// Dangerous — balance can be manipulated
require(address(this).balance == expectedAmount);

// Safe — track deposits yourself
uint256 internal accountedBalance;

function deposit() external payable {
    accountedBalance += msg.value;
}
```

Never use `address(this).balance` as a security invariant. Track your own accounting.

---

## 8. tx.origin Phishing

Covered in S8 but critical enough to repeat with a concrete attack scenario:

```solidity
// Vulnerable wallet
contract Wallet {
    address owner;

    function transfer(address to, uint256 amount) external {
        require(tx.origin == owner, "Not owner"); // dangerous
        payable(to).transfer(amount);
    }
}
```

Attack:
1. Attacker deploys `MaliciousContract`
2. Tricks the owner into calling `MaliciousContract` (fake airdrop, phishing site)
3. `MaliciousContract.receive()` calls `Wallet.transfer(attacker, vault.balance)`
4. `tx.origin` is still the owner → check passes → funds drained

`msg.sender` would be `MaliciousContract` — the check would correctly fail. Always use `msg.sender`.

---

## 9. Signature Replay

If your contract verifies signatures without tracking used ones, an attacker can resubmit the same valid signature multiple times:

```solidity
// Vulnerable — signature can be replayed
function claimReward(bytes memory sig) external {
    address signer = recoverSigner(msg.sender, sig);
    require(signer == owner, "Invalid sig");
    rewards[msg.sender] += 100; // can be called again with same sig
}
```

**Fix — nonce per user:**

```solidity
mapping(address => uint256) public nonces;

function claimReward(bytes memory sig, uint256 nonce) external {
    require(nonce == nonces[msg.sender], "Invalid nonce");
    address signer = recoverSigner(msg.sender, nonce, sig);
    require(signer == owner, "Invalid sig");

    nonces[msg.sender]++;        // invalidate this signature
    rewards[msg.sender] += 100;
}
```

Each signature includes the nonce. Once used, the nonce increments — the old signature is invalid.

Also include `block.chainid` in signed data to prevent cross-chain replay (same sig valid on mainnet and testnet).

---

## 10. Unsafe Delegatecall

`delegatecall` executes external code in the context of the calling contract — same storage, same `msg.sender`. Used by proxies and upgradeable contracts.

```solidity
// Dangerous if `impl` is untrusted
(bool ok,) = impl.delegatecall(data);
```

If `impl` is malicious or upgradeable to something malicious, it can overwrite your contract's storage — including the owner slot — with arbitrary values.

Rules:
- Only `delegatecall` to contracts you control
- Never `delegatecall` to user-supplied addresses
- Storage layout must match exactly between proxy and implementation

---

## 11. Common Mistakes Summary

| Mistake | Attack | Fix |
|---------|--------|-----|
| Interactions before effects | Reentrancy | CEI pattern + `nonReentrant` |
| `tx.origin` for auth | Phishing | Use `msg.sender` |
| Unbounded loops / push payments | DoS | Pull pattern |
| `address(this).balance` checks | Force-feed | Track balance manually |
| Signature without nonce | Replay attack | Nonce + chainid in signature |
| `delegatecall` to untrusted address | Storage corruption | Only delegatecall to trusted contracts |
| `uint` arithmetic pre-0.8 | Overflow/underflow | Use `^0.8.0`, avoid `unchecked` on user input |

---

## Summary

The most important rules:

1. **CEI always** — never call external contracts before updating your own state
2. **`nonReentrant` on all ETH-sending functions** — belt and suspenders
3. **`msg.sender` not `tx.origin`** — always
4. **Pull over push** — let users claim, don't loop-send
5. **Never rely on `address(this).balance`** — it can be manipulated
6. **Track nonces** — any signature-based system needs replay protection
7. **`unchecked` only when provably safe** — not on user inputs

---

## What's Next

**P-S10** — Practice set: you'll identify vulnerabilities in broken contracts, fix reentrancy bugs, apply CEI, and implement replay protection. This is the last practice set before the Contracts section (C1–C10).
