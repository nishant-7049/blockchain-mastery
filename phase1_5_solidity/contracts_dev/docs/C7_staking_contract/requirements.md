# C7 — Staking Contract

## Overview

Users stake ERC-20 tokens to earn a fixed APY reward. Rewards are only paid if the stake is held for at least the minimum lock duration. Early unstake returns principal only. Owner funds the reward pool separately.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `address immutable` | Controls admin functions |
| `stakingToken` | `address immutable` | ERC-20 token used for staking and rewards |
| `apyBps` | `uint256` | Annual percentage yield in basis points (1000 = 10%) |
| `minStakeAmount` | `uint256` | Minimum tokens required to stake |
| `minLockDuration` | `uint256` | Minimum seconds to hold stake and earn rewards |
| `rewardPool` | `uint256` | Total reward tokens available for payouts |
| `stakes` | `mapping(address => Stake)` | Active stake per user |

## Structs

```
struct Stake {
    uint256 amount      // tokens staked
    uint256 startTime   // block.timestamp when staked
}
```

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `stake(uint256 amount)` | anyone | Transfer tokens in, record stake. Reverts if already staking, below minimum, or token transfer fails. |
| `unstake()` | staker only | Withdraw principal. If `block.timestamp - startTime >= minLockDuration`, also pay rewards from pool. |
| `depositRewards(uint256 amount)` | owner only | Transfer reward tokens into contract, increase `rewardPool`. |
| `setAPY(uint256 bps)` | owner only | Update APY. Affects future reward calculations only. |
| `setMinStakeAmount(uint256 amount)` | owner only | Update minimum stake amount. |
| `setMinLockDuration(uint256 duration)` | owner only | Update minimum lock duration. |
| `pendingReward(address user)` | view | Returns current accrued reward for a user. 0 if not staking or below min duration. |

## Reward Formula

```
reward = stake.amount * apyBps * duration / (365 days * 10000)
```

Where `duration = block.timestamp - stake.startTime`.

If `rewardPool < reward`, pay whatever is left in the pool (partial reward).

## Rules

- User can only have one active stake at a time
- Cannot stake 0 or below `minStakeAmount`
- Cannot unstake if not staking
- Early unstake (duration < minLockDuration) returns principal only, no reward
- `setAPY` change does not retroactively affect existing stakes

## Events

| Event | When |
|-------|------|
| `Staked(address indexed user, uint256 amount)` | Tokens staked |
| `Unstaked(address indexed user, uint256 amount, uint256 reward)` | Tokens withdrawn (reward = 0 if early) |
| `RewardsDeposited(uint256 amount)` | Owner deposits rewards |
| `APYUpdated(uint256 oldBps, uint256 newBps)` | APY changed |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner calls admin function |
| `AlreadyStaking()` | User tries to stake while already having an active stake |
| `NotStaking()` | User tries to unstake with no active stake |
| `BelowMinimum()` | Stake amount below `minStakeAmount` |
| `ZeroAmount()` | Zero passed to stake or depositRewards |
| `TransferFailed()` | ERC-20 transfer returns false |
