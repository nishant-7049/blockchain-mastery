# C9 — Simple DEX (Liquidity Pool)

## Overview

A single liquidity pool for two ERC-20 tokens using the constant product formula (`x * y = k`). Liquidity providers deposit both tokens and receive LP tokens representing their share of the pool. Anyone can swap one token for the other, paying a fixed fee that stays in the pool as profit for liquidity providers.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `tokenA` | `address immutable` | First ERC-20 token in the pair |
| `tokenB` | `address immutable` | Second ERC-20 token in the pair |
| `reserveA` | `uint256` | Current pool balance of tokenA |
| `reserveB` | `uint256` | Current pool balance of tokenB |
| `feeBps` | `uint256 immutable` | Swap fee in basis points (e.g. 30 = 0.3%) |
| `totalSupply` | `uint256` | Total LP tokens minted |
| `balanceOf` | `mapping(address => uint256)` | LP token balance per address |
| `MINIMUM_LIQUIDITY` | `uint256 constant` | `1000` — locked forever on first deposit to prevent price manipulation |

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `addLiquidity(uint256 amountA, uint256 amountB)` | anyone | Deposit tokenA and tokenB, receive LP tokens. First deposit sets the ratio. Subsequent deposits must match the current ratio exactly. |
| `removeLiquidity(uint256 lpAmount)` | LP holder | Burn LP tokens, receive proportional share of both reserves. |
| `swap(address tokenIn, uint256 amountIn)` | anyone | Swap `amountIn` of `tokenIn` for the other token. Applies fee. Uses constant product formula. |
| `getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)` | pure | Returns output amount given input amount and reserves, after fee. |

## LP Token Minting

**First deposit:**
```
lpMinted = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
```
`MINIMUM_LIQUIDITY` (1000) is minted to `address(0)` and locked forever.

**Subsequent deposits:**
```
lpMinted = min(
    amountA * totalSupply / reserveA,
    amountB * totalSupply / reserveB
)
```
Amounts must be proportional to current reserves. Reverts if ratio does not match.

## LP Token Burning (removeLiquidity)

```
amountA = lpAmount * reserveA / totalSupply
amountB = lpAmount * reserveB / totalSupply
```

## Swap Formula (Constant Product with Fee)

```
amountInWithFee = amountIn * (10000 - feeBps)
amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee)
```

After the swap, reserves are updated so that `newReserveA * newReserveB >= reserveA * reserveB`.

## Rules

- `tokenA` and `tokenB` must be different non-zero addresses
- `feeBps` must be > 0 and < 10000
- Cannot add zero liquidity
- Cannot remove more LP tokens than you hold
- `swap` reverts if `tokenIn` is neither `tokenA` nor `tokenB`
- `swap` reverts if computed `amountOut` is 0
- Reserves must always stay > 0 after a swap (pool cannot be drained)
- First depositor receives `sqrt(amountA * amountB) - 1000` LP tokens; 1000 permanently locked

## Events

| Event | When |
|-------|------|
| `LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpMinted)` | Liquidity deposited |
| `LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpBurned)` | Liquidity withdrawn |
| `Swapped(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountOut)` | Swap executed |

## Errors

| Error | When |
|-------|------|
| `InvalidToken()` | `tokenA == tokenB`, zero address, or `tokenIn` not in pair |
| `InvalidFee()` | `feeBps == 0` or `feeBps >= 10000` |
| `ZeroAmount()` | Zero passed to any function |
| `ZeroLiquidity()` | LP minted would be 0 |
| `InsufficientLiquidity()` | `amountOut == 0` or pool would be drained |
| `RatioMismatch()` | Subsequent deposit doesn't match current reserve ratio |
| `InsufficientBalance()` | LP holder tries to remove more than they own |

## Sqrt Helper

Implement Babylonian square root for LP token calculation on first deposit:

```solidity
function sqrt(uint256 y) internal pure returns (uint256 z) {
    if (y > 3) {
        z = y;
        uint256 x = y / 2 + 1;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    } else if (y != 0) {
        z = 1;
    }
}
```
