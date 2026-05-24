# P-S9 — Advanced Types & Gas Optimization Practice Set

Each exercise gives you a broken or gas-heavy contract. Your job is to rewrite it to be correct and/or cheaper. Write your solutions in separate files named by exercise (e.g. `E1_StoragePacking.sol`).

Exercises escalate: packing → caching → calldata → function types → custom types.

---

## Exercise 1 — Storage Packing

The following contract wastes storage slots. Rewrite it so the variables are packed as tightly as possible without changing their types or removing any variable.

```solidity
contract Unpacked {
    uint256 id;
    bool active;
    uint256 timestamp;
    uint8 tier;
    address owner;
    bool paused;
    uint64 score;
}
```

**Questions:**
1. How many slots does the original use?
2. How many slots does your packed version use?
3. Why can't you pack `uint256` with anything else?

---

## Exercise 2 — Struct Packing

Rewrite the struct so it fits in as few slots as possible. Do not change any field types or remove any fields.

```solidity
struct Player {
    uint256 experience;
    address wallet;
    uint64 joinedAt;
    bool active;
    uint256 score;
    uint8 level;
    uint64 lastSeen;
}
```

**Questions:**
1. How many slots does the original struct use?
2. How many slots does your packed version use?

---

## Exercise 3 — Cache Storage Reads

The contract below reads from storage repeatedly. Rewrite the functions to minimize SLOADs by caching in local variables.

```solidity
contract Registry {
    address[] public members;
    mapping(address => uint256) public scores;

    function totalScore() external view returns (uint256 total) {
        for (uint256 i = 0; i < members.length; i++) {
            total += scores[members[i]];
        }
    }

    function topScore() external view returns (uint256 top) {
        for (uint256 i = 0; i < members.length; i++) {
            if (scores[members[i]] > top) {
                top = scores[members[i]];
            }
        }
    }
}
```

List every SLOAD you eliminated and where.

---

## Exercise 4 — Calldata vs Memory

The contract below uses `memory` for all parameters. Identify which parameters should be `calldata` and rewrite the function signatures. Do not change any logic.

```solidity
contract Processor {

    event Processed(address sender, uint256 total);

    function sum(uint256[] memory numbers) external pure returns (uint256 total) {
        for (uint256 i = 0; i < numbers.length; ++i) {
            total += numbers[i];
        }
    }

    function contains(address[] memory list, address target) external pure returns (bool) {
        for (uint256 i = 0; i < list.length; ++i) {
            if (list[i] == target) return true;
        }
        return false;
    }

    function processAndEmit(uint256[] memory data) external returns (uint256 total) {
        for (uint256 i = 0; i < data.length; ++i) {
            total += data[i];
        }
        emit Processed(msg.sender, total);
    }
}
```

**Question:** One of the three functions cannot use `calldata`. Which one, and why?

---

## Exercise 5 — Constant and Immutable

The contract below stores values in regular state variables that never change. Mark each one correctly as `constant` or `immutable`. Explain your choice for each.

```solidity
contract TokenConfig {
    string public name = "MyToken";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint256 public maxSupply = 1_000_000 * 10 ** 18;
    address public treasury;
    uint256 public deployedAt;

    constructor(address _treasury) {
        treasury = _treasury;
        deployedAt = block.timestamp;
    }
}
```

---

## Exercise 6 — Custom Errors + Short-Circuit

Rewrite the following function to:
1. Replace all `require` strings with custom errors
2. Reorder the checks so the cheapest ones run first

```solidity
contract Vault {
    mapping(address => uint256) public balances;
    mapping(address => bool) public blacklisted;
    bool public paused;

    function withdraw(uint256 amount) external {
        require(
            keccak256(abi.encodePacked(msg.sender)) != keccak256(abi.encodePacked(address(0))),
            "Zero address"
        );
        require(!paused, "Paused");
        require(!blacklisted[msg.sender], "Blacklisted");
        require(amount > 0, "Zero amount");
        require(balances[msg.sender] >= amount, "Insufficient");

        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}
```

List the order you chose and why each check is cheaper or more expensive than the others.

---

## Exercise 7 — Function Types (Strategy Pattern)

Write a contract `SortedVault` that:

- Has a `mapping(address => uint256) public balances`
- Has a state variable `feeStrategy` that holds a function: takes `uint256`, returns `uint256`
- Has two internal fee functions:
  - `flatFee(uint256)` — always returns `0.001 ether`
  - `percentFee(uint256 amount)` — returns `amount / 100` (1%)
- Constructor sets `feeStrategy = flatFee`
- `setStrategy(uint8 mode)` — `0` sets flat, `1` sets percent (only owner)
- `deposit()` — payable, adds `msg.value` to `balances[msg.sender]`
- `withdraw(uint256 amount)` — deducts fee using `feeStrategy`, sends `amount - fee` to caller, sends `fee` to owner

---

## Exercise 8 — User-Defined Value Types (Boss Exercise)

You are building a token contract. Currently all amounts and prices are raw `uint256` — easy to accidentally pass a price where an amount is expected.

Define:
- `type TokenAmount is uint256`
- `type TokenPrice is uint256`

Write a contract `TypedToken` with:
- `mapping(address => TokenAmount) public balances`
- `TokenPrice public price` — set in constructor (e.g. `1000`)
- `function mint(address to, TokenAmount amount) external` — adds to balance, no wrapping/unwrapping needed in the mapping
- `function getCost(TokenAmount amount) external view returns (TokenAmount)` — returns `amount * price` (you'll need to unwrap both to multiply, then wrap the result)
- `function transfer(address to, TokenAmount amount) external` — moves balance, reverts if insufficient

**Question:** `getCost` returns `TokenAmount` but it's really a cost in some base currency — is this the right return type? What would be more correct and why?

---

## Thinking Questions

Answer in comments at the top of any solution file:

1. You have a struct with `uint128 a`, `uint256 b`, `uint128 c`. How many slots does it use? How would you fix it?
2. Why is `uint256` cheaper than `uint8` for a local variable inside a function, even though `uint8` is smaller?
3. A colleague says "I'll use events instead of storage for everything to save gas." What's wrong with this?
4. What is the difference between `constant` and `immutable`? Give a case where you can only use `immutable`.
5. In Exercise 6, why is the zero-address check using `keccak256` wasteful beyond just the revert string?
