# S7 — Events & Logging

> Covers: emit events, indexed parameters, why events matter for dApps

---

## 1. What Are Events?

Events are Solidity's way of writing logs to the blockchain. When you emit an event, it gets stored in the **transaction receipt** — not in contract storage.

This means:
- Events are **much cheaper** than storing data in state variables
- Events **cannot be read** by smart contracts (only by off-chain code)
- Events are **permanent** — stored in the blockchain forever, attached to the transaction

Every major action in a contract should emit an event. This is how frontends, indexers, and block explorers know what happened.

---

## 2. Declaring and Emitting Events

```solidity
contract Token {
    // declare the event
    event Transfer(address from, address to, uint256 amount);
    event Approval(address owner, address spender, uint256 amount);

    function transfer(address to, uint256 amount) external {
        // ... transfer logic ...

        // emit the event
        emit Transfer(msg.sender, to, amount);
    }
}
```

Syntax:
- `event EventName(type param, type param, ...)` — declaration
- `emit EventName(value, value, ...)` — emission

Convention: event names are **PascalCase**, emitted after state changes.

---

## 3. Indexed Parameters

Parameters can be marked `indexed` — this makes them **searchable/filterable** by off-chain code.

```solidity
event Transfer(
    address indexed from,    // indexed — can filter by sender
    address indexed to,      // indexed — can filter by recipient
    uint256 amount           // NOT indexed — just logged
);
```

**What indexed does:**
- Non-indexed params → stored in the log's `data` field (ABI-encoded, cheap to store)
- Indexed params → stored in the log's `topics` array (hashed, searchable)

Maximum **3 indexed parameters** per event (EVM limit). The event signature itself takes one topic slot, so you have 3 remaining.

**Why filtering matters:**

Without indexed:
```
// you'd have to scan EVERY Transfer event ever emitted to find Alice's
getAllTransferEvents() → filter manually → slow, expensive
```

With indexed:
```
// blockchain node filters at the RPC level — instant
getTransferEvents({ filter: { from: aliceAddress } }) → fast
```

This is how Etherscan shows you all transactions for an address — it queries indexed event logs.

---

## 4. Event vs State Variable — When to Use Which

| | State Variable | Event |
|---|---|---|
| Readable by contracts | ✅ yes | ❌ no |
| Readable by frontend | ✅ yes | ✅ yes |
| Gas cost | Expensive (SSTORE) | Cheap (LOG opcode) |
| Permanent history | ❌ only current value | ✅ full history |
| Searchable | ❌ no | ✅ if indexed |

**Key insight:** State variables only store the *current* value. Events store *history*.

```solidity
uint256 public price; // only tells you the price RIGHT NOW

event PriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp);
// tells you every price change ever made, when, and by how much
```

If you need to answer "what was the price 3 days ago?" — you need events, not state variables.

---

## 5. Naming Conventions

Events use past tense or noun form to describe what happened:

```solidity
event Transfer(...)        // noun — standard ERC-20
event Deposit(...)         // noun
event Withdrawn(...)       // past tense
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
event Paused(address account);
event Unpaused(address account);
```

Emit events **after** state changes (follows CEI — interactions last):

```solidity
function transfer(address to, uint256 amount) external {
    // CHECKS
    require(balances[msg.sender] >= amount);

    // EFFECTS
    balances[msg.sender] -= amount;
    balances[to] += amount;

    // emit after state is updated
    emit Transfer(msg.sender, to, amount);
}
```

---

## 6. Events in Practice — ERC-20 Standard

The ERC-20 standard mandates these events — any contract claiming to be ERC-20 must emit them:

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
```

These two events are why:
- Etherscan can show your token transfers
- MetaMask can display your token balance history
- The Graph can index your protocol
- Analytics dashboards can chart your volume

Without events, your contract is a black box to the outside world.

---

## 7. Reading Events Off-Chain

Events are read using filters in ethers.js or web3.js:

```javascript
// ethers.js example
const filter = token.filters.Transfer(aliceAddress, null); // from Alice, to anyone
const events = await token.queryFilter(filter, fromBlock, toBlock);

events.forEach(e => {
    console.log(`${e.args.from} → ${e.args.to}: ${e.args.amount}`);
});
```

The `indexed` parameters become the filter fields. Non-indexed are in `e.args` but can't be filtered at the RPC level.

---

## 8. Anonymous Events

Rare, but worth knowing. Adding `anonymous` removes the event signature from topics:

```solidity
event SecretLog(address indexed addr) anonymous;
```

Normal events use one topic slot for the event signature hash (keccak256 of the event name + param types). Anonymous events skip this, freeing one more topic slot (max 4 indexed params instead of 3).

Used occasionally in gas-optimized contracts. Not common in everyday code.

---

## 9. Full Example — Auction with Complete Event Coverage

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error BiddingClosed();
error BidTooLow(uint256 current, uint256 sent);
error AlreadyFinalized();
error NotOwner();

contract Auction {
    // Events — every state change logged
    event AuctionStarted(address indexed owner, uint256 startTime);
    event BidPlaced(address indexed bidder, uint256 amount, uint256 previousBid);
    event Outbid(address indexed bidder, uint256 refundAmount);
    event AuctionEnded(address indexed winner, uint256 finalBid, uint256 endTime);
    event RefundClaimed(address indexed bidder, uint256 amount);

    address public immutable owner;
    address public highestBidder;
    uint256 public highestBid;
    bool public ended;
    mapping(address => uint256) public refunds;

    constructor() {
        owner = msg.sender;
        emit AuctionStarted(msg.sender, block.timestamp);
    }

    function bid() external payable {
        if (ended) revert BiddingClosed();
        if (msg.value <= highestBid) revert BidTooLow(highestBid, msg.value);

        address previousBidder = highestBidder;
        uint256 previousBid = highestBid;

        // EFFECTS
        if (previousBidder != address(0)) {
            refunds[previousBidder] += previousBid;
            emit Outbid(previousBidder, previousBid);
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit BidPlaced(msg.sender, msg.value, previousBid);
    }

    function finalize() external {
        if (msg.sender != owner) revert NotOwner();
        if (ended) revert AlreadyFinalized();

        ended = true;
        emit AuctionEnded(highestBidder, highestBid, block.timestamp);

        (bool ok,) = payable(owner).call{value: highestBid}("");
        require(ok);
    }

    function claimRefund() external {
        uint256 amount = refunds[msg.sender];
        require(amount > 0, "no refund");

        refunds[msg.sender] = 0;
        emit RefundClaimed(msg.sender, amount);

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok);
    }
}
```

Every state change has an event:
- Auction created → `AuctionStarted`
- New bid → `BidPlaced`
- Previous bidder outbid → `Outbid`
- Auction closed → `AuctionEnded`
- Refund claimed → `RefundClaimed`

A frontend can reconstruct the entire auction history from these events alone — no extra storage needed.

---

## Summary

| Concept | Key point |
|---------|-----------|
| `event` | Declare what to log |
| `emit` | Write the log when it happens |
| `indexed` | Makes param filterable, max 3 per event |
| Non-indexed | Cheaper, stored in data field, not filterable |
| vs state variable | Events = history, state = current value |
| When to emit | After every state change |
| ERC-20 standard | Transfer + Approval events are mandatory |

---

→ **Practice Set P-S7** — Events exercises
→ After that: **S8: Modifiers & Access Control**
