# C2 — Ether Wallet (Multi-User Vault)

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `address immutable` | Set in constructor, controls admin functions |
| `paused` | `bool` | Blocks deposits and withdrawals when true |
| `feeBps` | `uint256` | Withdrawal fee in basis points (100 = 1%) |
| `balances` | `mapping(address => uint256)` | Per-user ETH balance |

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `deposit()` | anyone, payable | Add ETH to caller's balance. Reverts if paused or zero value. |
| `withdraw(uint256 amount)` | anyone | Withdraw own ETH. Fee deducted, remainder sent to caller. Reverts if paused, zero, or insufficient balance. |
| `balanceOf(address)` | anyone, view | Returns stored balance of any address. |
| `setFee(uint256 bps)` | owner only | Update withdrawal fee in basis points. |
| `pause()` | owner only | Pause the contract. |
| `unpause()` | owner only | Unpause the contract. |

## Fee Logic

- Fee is taken from withdrawal amount: `fee = amount * feeBps / 10000`
- User receives: `amount - fee`
- Fee goes to `owner`
- No fee on deposit

## Events

| Event | When |
|-------|------|
| `Deposited(address indexed user, uint256 amount)` | On successful deposit |
| `Withdrawn(address indexed user, uint256 amount, uint256 fee)` | On successful withdrawal |
| `Paused()` | When owner pauses |
| `Unpaused()` | When owner unpauses |
| `FeeUpdated(uint256 oldFee, uint256 newFee)` | When fee is changed |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner calls owner-only function |
| `ZeroAmount()` | deposit or withdraw called with 0 |
| `InsufficientBalance(uint256 available, uint256 requested)` | Withdraw amount exceeds balance |
| `ContractPaused()` | deposit or withdraw called while paused |
| `TransferFailed()` | ETH transfer to user or owner fails |
