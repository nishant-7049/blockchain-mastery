# S6 — ETH Handling

> Covers: payable functions, receive, fallback, transfer vs call vs send

---

## 1. How ETH Enters a Contract

There are three ways ETH can be sent to a contract:

1. **Calling a `payable` function** — most common, intentional
2. **Plain ETH transfer with no data** — triggers `receive()`
3. **ETH transfer with data that matches no function** — triggers `fallback()`

If none of these exist and ETH is sent, the transaction **reverts**.

---

## 2. The `payable` Keyword

Any function that should accept ETH must be marked `payable`. Without it, sending ETH to that function reverts automatically.

```solidity
contract Vault {
    uint256 public balance;

    // ✅ accepts ETH
    function deposit() external payable {
        balance += msg.value;
    }

    // ❌ sending ETH here reverts
    function doSomething() external {
        // msg.value is always 0 here
    }
}
```

Constructors can also be `payable` — lets you fund a contract at deployment:

```solidity
constructor() payable {
    balance = msg.value; // ETH sent during deployment
}
```

Addresses can be `payable` too — required before sending ETH to them:

```solidity
address payable recipient = payable(msg.sender);
recipient.transfer(1 ether); // only works on payable addresses
```

---

## 3. `receive()` — Plain ETH Transfers

`receive()` is a special function that triggers when:
- ETH is sent to the contract
- With **no calldata** (no function call, just a plain transfer)

```solidity
contract Piggy {
    uint256 public total;

    receive() external payable {
        total += msg.value; // runs when ETH sent with no data
    }
}
```

Rules:
- No function name — just `receive`
- Must be `external payable`
- No arguments, no return value
- Only one per contract
- Has 2300 gas limit when triggered by `.transfer()` or `.send()`

If you send ETH to a contract with no `receive()` and no `fallback()`, it reverts.

---

## 4. `fallback()` — Catch-All

`fallback()` triggers when:
- A function is called that **doesn't exist** on the contract
- OR ETH is sent with calldata that matches no function
- OR ETH is sent with no data but there's no `receive()` (fallback acts as backup)

```solidity
contract Proxy {
    fallback() external payable {
        // catches everything that doesn't match a function
    }
}
```

Rules:
- No function name — just `fallback`
- Must be `external`
- Optionally `payable` (if you want it to accept ETH)
- No arguments (but can access `msg.data` directly)

**Decision tree when ETH is sent to a contract:**

```
ETH sent to contract
        │
        ▼
  msg.data empty?
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
receive()  fallback()
exists?    (if payable)
  ┌─┴─┐
 YES  NO
  │    │
  ▼    ▼
receive() fallback()
```

---

## 5. transfer vs send vs call

Three ways to send ETH from a contract. They look similar but behave very differently.

### `.transfer(amount)`

```solidity
payable(recipient).transfer(1 ether);
```

- Forwards **2300 gas** only
- Reverts automatically on failure — no return value to check
- Simple but **dangerous** — if recipient is a contract with any logic in `receive()`, it runs out of gas and reverts

### `.send(amount)`

```solidity
bool success = payable(recipient).send(1 ether);
require(success, "send failed");
```

- Forwards **2300 gas** only (same as transfer)
- Returns `bool` — does NOT revert on failure, you must check manually
- Deprecated — same gas problem as transfer, worse API

### `.call{value: amount}("")`

```solidity
(bool ok, bytes memory data) = payable(recipient).call{value: amount}("");
require(ok, "transfer failed");
```

- Forwards **all remaining gas** (or a specified limit)
- Returns `(bool, bytes memory)` — must check the bool manually
- **Modern standard** — what you should always use
- Requires CEI pattern since it forwards full gas (reentrancy possible)

**Comparison table:**

| | `.transfer()` | `.send()` | `.call()` |
|---|---|---|---|
| Gas forwarded | 2300 | 2300 | All (or custom) |
| Reverts on failure | ✅ auto | ❌ must check | ❌ must check |
| Returns value | nothing | `bool` | `(bool, bytes)` |
| Reentrancy risk | Low (gas limited) | Low (gas limited) | **High** (must use CEI) |
| Recommended | ❌ avoid | ❌ avoid | ✅ use this |

**Why `.transfer()` and `.send()` are deprecated:**

After EIP-1884 (2019), some opcodes became more expensive. Contracts with `receive()` functions that use storage (very common) now cost more than 2300 gas. This means `.transfer()` and `.send()` silently break for many recipient contracts. `.call()` forwards all gas so this is never an issue.

---

## 6. Sending ETH — Correct Pattern

```solidity
// ❌ old way
payable(recipient).transfer(amount);

// ✅ modern way
(bool ok, ) = payable(recipient).call{value: amount}("");
require(ok, "ETH transfer failed");
```

You can also specify a gas limit if needed:
```solidity
(bool ok, ) = payable(recipient).call{value: amount, gas: 5000}("");
```

---

## 7. The Pull Pattern vs Push Pattern

**Push** — you send ETH to users proactively:
```solidity
// RISKY — one failed transfer reverts entire loop
function payAll() external {
    for (uint i = 0; i < recipients.length; i++) {
        (bool ok,) = payable(recipients[i]).call{value: shares[i]}("");
        require(ok, "failed"); // one failure kills everyone's payment
    }
}
```

**Pull** — users claim their own ETH:
```solidity
mapping(address => uint256) public pending;

// queue the payments
function queuePayments() external {
    for (uint i = 0; i < recipients.length; i++) {
        pending[recipients[i]] += shares[i];
    }
}

// each user claims independently
function claim() external {
    uint256 amount = pending[msg.sender];
    require(amount > 0, "nothing to claim");
    pending[msg.sender] = 0;           // CEI
    (bool ok,) = payable(msg.sender).call{value: amount}("");
    require(ok, "claim failed");
}
```

Pull pattern is safer because:
- One bad recipient can't block everyone else
- Each claim is isolated
- CEI is easier to enforce

---

## 8. Checking if a Contract Can Receive ETH

Before sending ETH to an address you don't control, you can't guarantee it will accept it. A contract without `receive()` or `payable fallback()` will reject ETH.

This is why the return value from `.call()` matters — always check it:

```solidity
(bool ok,) = payable(recipient).call{value: amount}("");
if (!ok) revert TransferFailed(recipient, amount);
```

---

## 9. Full Example — Splitter Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error NoRecipients();
error AlreadyAdded(address recipient);
error NothingToSplit();
error ClaimFailed();
error ZeroDeposit();

contract Splitter {
    address public immutable owner;
    address[] public recipients;
    mapping(address => bool) public isRecipient;
    mapping(address => uint256) public pending;

    constructor() {
        owner = msg.sender;
    }

    // accept ETH directly
    receive() external payable {
        _split(msg.value);
    }

    // or deposit explicitly
    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        _split(msg.value);
    }

    function addRecipient(address r) external {
        require(msg.sender == owner, "not owner");
        if (isRecipient[r]) revert AlreadyAdded(r);
        recipients.push(r);
        isRecipient[r] = true;
    }

    function _split(uint256 amount) internal {
        if (recipients.length == 0) revert NoRecipients();
        uint256 share = amount / recipients.length;
        for (uint256 i = 0; i < recipients.length; i++) {
            pending[recipients[i]] += share;
        }
        // remainder stays in contract (dust)
    }

    // pull pattern — each recipient claims their own share
    function claim() external {
        uint256 amount = pending[msg.sender];
        require(amount > 0, "nothing to claim");
        pending[msg.sender] = 0;                              // CEI
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert ClaimFailed();
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
```

Notice:
- `receive()` — catches plain ETH transfers
- `deposit()` — explicit deposit function
- Pull pattern via `pending` mapping + `claim()`
- CEI in `claim()` — zeroes out before calling
- `.call()` — modern ETH sending
- Remainder from integer division stays as dust

---

## Summary

| Concept | Key point |
|---------|-----------|
| `payable` function | Must be marked to accept ETH |
| `receive()` | Triggered by plain ETH transfers (no calldata) |
| `fallback()` | Catches unknown function calls + optional ETH |
| `.transfer()` | 2300 gas, auto-reverts — avoid |
| `.send()` | 2300 gas, returns bool — avoid |
| `.call{value: x}("")` | All gas, returns bool — always use this |
| Push pattern | Send to everyone — risky if one fails |
| Pull pattern | Let users claim — safer, isolated failures |

---

→ **Practice Set P-S6** — ETH handling exercises
→ After that: **S7: Events & Logging**
