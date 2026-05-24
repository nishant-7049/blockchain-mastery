# C3 — Multi-Sig Wallet

## Overview

N owners collectively control funds. Any owner can propose a transaction.
A transaction executes only when strictly more than half of all owners confirm it.
Transactions expire if threshold is not reached in time.
Adding/removing owners also requires multisig approval.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `owners` | `address[]` | List of current owners |
| `isOwner` | `mapping(address => bool)` | Quick ownership lookup |
| `required` | `uint256` | Confirmations needed — always `owners.length / 2 + 1` |
| `transactions` | `Transaction[]` | All proposed transactions |
| `confirmed` | `mapping(uint256 => mapping(address => bool))` | Whether an owner confirmed a tx |
| `expiryDuration` | `uint256` | How long a tx stays open (set in constructor, e.g. 7 days) |

## Transaction Struct

```
struct Transaction {
    address to
    uint256 value
    bytes data
    bool executed
    uint256 confirmationCount
    uint256 expiresAt
}
```

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `propose(address to, uint256 value, bytes data)` | owner only | Creates a new tx, proposer auto-confirms it |
| `confirm(uint256 txId)` | owner only | Add confirmation. Executes tx if threshold reached. |
| `revoke(uint256 txId)` | owner only | Remove own confirmation before execution |
| `execute(uint256 txId)` | owner only | Manually trigger execution once threshold is met |
| `addOwner(address)` | `onlySelf` | Add a new owner. Called via multisig tx to `address(this)`. |
| `removeOwner(address)` | `onlySelf` | Remove an owner. Updates `required`. |

## Key Design Decisions

### `onlySelf` modifier
`addOwner` and `removeOwner` are protected by `onlySelf` — only callable when `msg.sender == address(this)`.
To add/remove an owner, propose a tx with `to = address(this)` and `data = abi.encodeCall(this.addOwner, newAddr)`.
When the multisig executes it, the wallet calls itself.

### `required` updates dynamically
Recalculate after every add/remove: `required = owners.length / 2 + 1`

### Expiry
`expiresAt = block.timestamp + expiryDuration` set at proposal time.
`confirm` and `execute` revert if `block.timestamp > expiresAt`.

### Auto-execute on confirm
When the Nth confirming owner pushes confirmationCount to `required`, `confirm` immediately calls `execute` internally — no separate step needed.

## Events

| Event | When |
|-------|------|
| `Proposed(uint256 indexed txId, address indexed proposer, address to, uint256 value)` | New tx proposed |
| `Confirmed(uint256 indexed txId, address indexed owner)` | Owner confirms |
| `Revoked(uint256 indexed txId, address indexed owner)` | Owner revokes confirmation |
| `Executed(uint256 indexed txId)` | Tx executed successfully |
| `ExecutionFailed(uint256 indexed txId)` | Tx execution failed (ETH call failed) |
| `OwnerAdded(address indexed owner)` | New owner added |
| `OwnerRemoved(address indexed owner)` | Owner removed |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner or non-self calls restricted function |
| `TxDoesNotExist()` | txId out of range |
| `AlreadyExecuted()` | Tx already executed |
| `AlreadyConfirmed()` | Owner already confirmed this tx |
| `NotConfirmed()` | Owner tries to revoke without having confirmed |
| `TxExpired()` | block.timestamp > expiresAt |
| `ZeroAddress()` | Adding zero address as owner |
| `AlreadyOwner()` | Adding an address that is already an owner |
| `NotOwner()` | Removing an address that is not an owner |
| `MinOwnersRequired()` | Removing owner would leave fewer than 1 owner |
