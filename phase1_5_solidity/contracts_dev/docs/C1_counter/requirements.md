# C1 — Counter Contract Requirements

## What it does
A simple on-chain counter. Anyone can increment it, only the owner can reset it.

## State
| Variable | Type | Description |
|----------|------|-------------|
| `count` | `uint256` | Current counter value, starts at 0 |
| `owner` | `address` | Set in constructor, never changes |

## Functions
| Function | Access | Behaviour |
|----------|--------|-----------|
| `increment()` | Anyone | Adds 1 to count, emits Incremented |
| `reset()` | Owner only | Sets count to 0, emits Reset |

## Events
| Event | Params | When |
|-------|--------|------|
| `Incremented` | `address caller, uint256 newCount` | After every increment |
| `Reset` | — | After reset |

## Errors
| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner calls reset() |

## Constraints
- count can never go negative (uint256 guarantees this)
- No upper limit on count
- Owner is immutable after deployment
