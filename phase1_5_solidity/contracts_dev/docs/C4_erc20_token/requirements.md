# C4 — ERC-20 Token

## Overview

Standard ERC-20 fungible token with mint and burn. Follows the ERC-20 interface exactly so any wallet or protocol can interact with it.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `name` | `string public` | Token name, set in constructor |
| `symbol` | `string public` | Token ticker, set in constructor |
| `decimals` | `uint8 public constant` | Always 18 |
| `totalSupply` | `uint256 public` | Total tokens in existence |
| `owner` | `address public immutable` | Set in constructor, controls mint |
| `balanceOf` | `mapping(address => uint256)` | Token balance per address |
| `allowance` | `mapping(address => mapping(address => uint256))` | Spending allowance: owner → spender → amount |

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `transfer(address to, uint256 amount)` | anyone | Send tokens from caller to `to` |
| `transferFrom(address from, address to, uint256 amount)` | anyone | Spend approved tokens on behalf of `from` |
| `approve(address spender, uint256 amount)` | anyone | Allow `spender` to spend `amount` of caller's tokens |
| `mint(address to, uint256 amount)` | owner only | Create new tokens, add to `to` balance and `totalSupply` |
| `burn(uint256 amount)` | anyone | Destroy caller's own tokens, reduce `totalSupply` |

## Events

| Event | When |
|-------|------|
| `Transfer(address indexed from, address indexed to, uint256 amount)` | On transfer, transferFrom, mint (from = address(0)), burn (to = address(0)) |
| `Approval(address indexed owner, address indexed spender, uint256 amount)` | On approve, and when allowance is consumed in transferFrom |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner calls mint |
| `ZeroAddress()` | to or from is address(0) |
| `ZeroAmount()` | amount is 0 |
| `InsufficientBalance(uint256 available, uint256 requested)` | Transfer or burn exceeds balance |
| `InsufficientAllowance(uint256 available, uint256 requested)` | transferFrom exceeds allowance |

## Notes

- `mint` emits `Transfer(address(0), to, amount)` — ERC-20 convention for minting
- `burn` emits `Transfer(msg.sender, address(0), amount)` — ERC-20 convention for burning
- `transferFrom` must reduce allowance after spending (unless allowance is `type(uint256).max` — infinite approval)
