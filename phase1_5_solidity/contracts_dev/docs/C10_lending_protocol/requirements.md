# C10 — Lending Protocol

## Overview

Users deposit ETH as collateral and borrow an ERC-20 token against it. Debt accrues interest every second. Positions that fall below the collateral ratio can be liquidated by anyone for a bonus. The owner deposits borrow tokens into the protocol's reserve and controls the ETH price feed (simulated oracle).

---

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `address immutable` | Controls admin functions |
| `borrowToken` | `address immutable` | ERC-20 token users can borrow |
| `ethPrice` | `uint256` | Price of 1 ETH in borrow token units (e.g. 2000e18 means 1 ETH = 2000 tokens). Set by owner |
| `interestRatePerSecond` | `uint256 immutable` | Interest rate per second scaled by 1e18 (e.g. 1585489599 ≈ 5% APY) |
| `collateralRatio` | `uint256 constant` | `150` — borrow up to 100/150 of collateral value |
| `liquidationBonus` | `uint256 constant` | `500` — liquidator gets 5% bonus in bps |
| `totalDebt` | `uint256` | Total outstanding debt including accrued interest |
| `totalDebtShares` | `uint256` | Total debt shares outstanding |
| `reserveBalance` | `uint256` | Borrow tokens available in the protocol |
| `lastAccrualTimestamp` | `uint256` | Last time interest was accrued |
| `positions` | `mapping(address => Position)` | Each user's collateral and debt |

---

## Structs

```
struct Position {
    uint256 collateral      // ETH deposited in wei
    uint256 debtShares      // user's share of totalDebt
}
```

---

## Interest Accrual (Aave-style debt shares)

**Debt shares** separate "how much you owe" from "what share of the pool you are."

Every second, interest grows the total debt but shares stay the same — so each share is worth more over time.

```
// On any state-changing call:
elapsed = block.timestamp - lastAccrualTimestamp
interest = totalDebt * interestRatePerSecond * elapsed / 1e18
totalDebt += interest
lastAccrualTimestamp = block.timestamp
```

**Borrow** `amount`:
```
shares = (totalDebtShares == 0)
    ? amount                                          // first borrow
    : amount * totalDebtShares / totalDebt            // subsequent
debtShares[user] += shares
totalDebtShares += shares
totalDebt += amount
```

**Repay** `amount`:
```
shares = amount * totalDebtShares / totalDebt
debtShares[user] -= shares
totalDebtShares -= shares
totalDebt -= amount
```

**Get user's current debt:**
```
debt = (totalDebtShares == 0) ? 0 : debtShares[user] * totalDebt / totalDebtShares
```

---

## Health Factor

```
collateralValue = position.collateral * ethPrice / 1e18    // in borrow token units
maxAllowedDebt  = collateralValue * 100 / collateralRatio  // = collateralValue * 100 / 150

healthFactor    = collateralValue * 100 / debt             // scaled: 150 = healthy, <150 = liquidatable
```

- `healthFactor >= collateralRatio (150)` → position is safe
- `healthFactor < collateralRatio (150)` → position can be liquidated

---

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `depositCollateral()` | anyone, payable | Deposit ETH. Adds to `position.collateral`. |
| `withdrawCollateral(uint256 amount)` | borrower | Withdraw ETH. Reverts if remaining collateral would put position below ratio. |
| `borrow(uint256 amount)` | borrower | Borrow ERC-20 tokens. Reverts if it would breach 150% ratio or reserve is insufficient. |
| `repay(uint256 amount)` | borrower | Repay ERC-20 debt. Reduces debtShares proportionally. |
| `liquidate(address user, uint256 repayAmount)` | anyone | Repay part or all of a user's debt, receive collateral + bonus. |
| `depositReserve(uint256 amount)` | owner | Deposit borrow tokens into protocol reserve. |
| `setEthPrice(uint256 price)` | owner | Update ETH price (simulated oracle). |
| `accrueInterest()` | public | Accrue interest on totalDebt. Called internally before every state change. |
| `getDebt(address user)` | view | Returns user's current debt including accrued interest. |
| `getHealthFactor(address user)` | view | Returns health factor (150 = at limit, >150 = safe, <150 = liquidatable). |

---

## Liquidation

Anyone can liquidate a position whose `healthFactor < collateralRatio`.

```
collateralToSeize = repayAmount * 1e18 * (10000 + liquidationBonus) / (10000 * ethPrice)
```

- Liquidator sends `repayAmount` borrow tokens → reduces user's debt
- Liquidator receives `collateralToSeize` ETH from user's collateral
- `repayAmount` cannot exceed user's full debt
- `collateralToSeize` is capped at user's available collateral (prevents revert on bad debt)

---

## Rules

- Cannot borrow if `healthFactor` would go below `collateralRatio` after the borrow
- Cannot withdraw collateral if it would breach `collateralRatio`
- Cannot borrow more than `reserveBalance`
- Cannot repay more than current debt (cap repay to full debt amount)
- Cannot liquidate a healthy position (`healthFactor >= collateralRatio`)
- Interest must be accrued before every borrow, repay, withdraw, liquidate

---

## Events

| Event | When |
|-------|------|
| `CollateralDeposited(address indexed user, uint256 amount)` | ETH deposited |
| `CollateralWithdrawn(address indexed user, uint256 amount)` | ETH withdrawn |
| `Borrowed(address indexed user, uint256 amount, uint256 shares)` | Tokens borrowed |
| `Repaid(address indexed user, uint256 amount, uint256 shares)` | Debt repaid |
| `Liquidated(address indexed liquidator, address indexed user, uint256 repaid, uint256 collateralSeized)` | Position liquidated |
| `ReserveDeposited(uint256 amount)` | Owner deposits tokens |
| `InterestAccrued(uint256 interest, uint256 newTotalDebt)` | Interest added to totalDebt |
| `EthPriceUpdated(uint256 oldPrice, uint256 newPrice)` | Oracle price updated |

---

## Errors

| Error | When |
|-------|------|
| `ZeroAmount()` | Zero passed to any function |
| `Unauthorized()` | Non-owner calls admin function |
| `InsufficientCollateral()` | Borrow or withdraw would breach collateral ratio |
| `InsufficientReserve(uint256 available)` | Borrow exceeds reserve balance |
| `PositionHealthy()` | Liquidate called on a safe position |
| `InsufficientDebt()` | Repay or liquidate amount exceeds user's debt |
| `TransferFailed()` | ETH or ERC-20 transfer fails |
| `NoCollateral()` | Withdraw called with no collateral deposited |
| `NoDebt()` | Repay called with no active debt |

---

## Example Flow

```
1. Owner sets ethPrice = 2000e18 (1 ETH = 2000 tokens)
2. Owner deposits 10,000 tokens into reserve

3. User deposits 1 ETH collateral
   → collateralValue = 1e18 * 2000e18 / 1e18 = 2000e18 tokens
   → maxBorrow = 2000e18 * 100 / 150 = 1333e18 tokens

4. User borrows 1000 tokens (below max)
   → healthFactor = 2000 * 100 / 1000 = 200 (safe, above 150)

5. Time passes, interest accrues
   → debt grows to say 1050 tokens

6. ETH price drops to 1400e18 (1 ETH = 1400 tokens)
   → collateralValue = 1400e18
   → healthFactor = 1400 * 100 / 1050 = 133 (below 150 → LIQUIDATABLE)

7. Liquidator repays 525 tokens (50% of debt)
   → collateralSeized = 525e18 * 1.05 / 1400 = 0.39375 ETH
   → User's debt: 1050 - 525 = 525 tokens
   → User's collateral: 1 ETH - 0.39375 ETH = 0.60625 ETH
```
