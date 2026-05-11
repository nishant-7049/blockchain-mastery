# S3 — Data Structures

> Covers: mappings, arrays, structs, enums, nested mappings

---

## 1. Mappings

A mapping is a key-value store. Think of it like a hash map or dictionary — given a key, you get a value instantly.

```solidity
mapping(KeyType => ValueType) visibility name;
```

```solidity
mapping(address => uint256) public balances;
mapping(address => bool)    public isWhitelisted;
mapping(uint256 => address) public tokenOwner;
```

**Reading and writing:**
```solidity
balances[msg.sender] = 100;          // write
uint256 b = balances[msg.sender];    // read
```

**Default value:** If you read a key that was never set, you get the zero value for that type — `0` for `uint256`, `false` for `bool`, `address(0)` for `address`. Mappings never throw "key not found."

```solidity
balances[0xABC...] // returns 0 if never set — not an error
```

**What you CANNOT do with mappings:**
- Iterate over them — no way to loop through all keys
- Get the length — no `.length`
- Pass them to functions as `memory` — mappings always stay in storage

---

## 2. Arrays

### Fixed-size arrays
Size is set at declaration and never changes.

```solidity
uint256[5] public scores;       // always exactly 5 elements
address[3] public signers;      // always exactly 3 addresses
```

### Dynamic arrays
Size can grow and shrink.

```solidity
uint256[] public votes;
address[] public members;
```

**Key operations:**
```solidity
votes.push(42);          // add to end
votes.pop();             // remove last element
votes.length;            // current length
votes[0];                // access by index (reverts if out of bounds)
delete votes[2];         // sets votes[2] to 0 — does NOT shrink array
```

**`delete` does not remove the element** — it just resets to zero value. The array length stays the same. To actually remove, you need to shift elements manually.

### Removing an element properly

**Order matters → shift left:**
```solidity
function removeOrdered(uint256 index) public {
    for (uint256 i = index; i < arr.length - 1; i++) {
        arr[i] = arr[i + 1];
    }
    arr.pop();
}
```

**Order doesn't matter → swap with last:**
```solidity
function removeUnordered(uint256 index) public {
    arr[index] = arr[arr.length - 1]; // overwrite with last
    arr.pop();                         // remove last
}
```

The swap-and-pop pattern is cheaper (O(1) vs O(n)).

### Arrays in memory

You can create temporary arrays in memory inside functions:

```solidity
function getDoubled(uint256[] memory input) public pure returns (uint256[] memory) {
    uint256[] memory result = new uint256[](input.length); // fixed size in memory
    for (uint256 i = 0; i < input.length; i++) {
        result[i] = input[i] * 2;
    }
    return result;
}
```

Memory arrays must be **fixed size** — you can't `push` to a memory array. Size is set at creation with `new Type[](n)`.

---

## 3. Structs

Structs group related data together under one type.

```solidity
struct Person {
    string name;
    uint256 age;
    address wallet;
}
```

**Creating struct instances:**
```solidity
// by position
Person memory p1 = Person("Alice", 30, 0xABC...);

// by field name (clearer, recommended)
Person memory p2 = Person({
    name: "Bob",
    age: 25,
    wallet: msg.sender
});
```

**Storing structs:**
```solidity
contract Registry {
    struct User {
        string name;
        uint256 balance;
        bool active;
    }

    mapping(address => User) public users;

    function register(string calldata name) external {
        users[msg.sender] = User({
            name: name,
            balance: 0,
            active: true
        });
    }

    function deposit() external payable {
        users[msg.sender].balance += msg.value; // update a single field
    }
}
```

**Storage pointer with structs — useful pattern:**
```solidity
function updateBalance(address user, uint256 amount) internal {
    User storage u = users[user]; // storage pointer — no copy
    u.balance += amount;          // writes directly to storage
    u.active = true;
}
```

`User storage u = users[user]` does not copy the struct — it's a reference. Modifying `u` modifies `users[user]` directly. Cheaper than reading and writing each field separately.

---

## 4. Enums

Enums define a fixed set of named states. Useful for tracking what "phase" or "status" something is in.

```solidity
enum Status { Pending, Active, Cancelled, Completed }
```

Internally, enums are stored as `uint8` starting from 0:
- `Pending` = 0
- `Active` = 1
- `Cancelled` = 2
- `Completed` = 3

**Using enums:**
```solidity
contract Order {
    enum Status { Pending, Active, Cancelled, Completed }

    Status public currentStatus;

    constructor() {
        currentStatus = Status.Pending; // default
    }

    function activate() external {
        require(currentStatus == Status.Pending, "not pending");
        currentStatus = Status.Active;
    }

    function cancel() external {
        require(
            currentStatus == Status.Pending || currentStatus == Status.Active,
            "cannot cancel"
        );
        currentStatus = Status.Cancelled;
    }
}
```

**Why enums over raw uint8:**
```solidity
uint8 status = 1;        // what does 1 mean? unclear
Status s = Status.Active; // self-documenting
```

Enums make state machines readable. If you ever see a contract managing phases, stages, or statuses — enums are the right tool.

---

## 5. Nested Mappings

Mappings can contain other mappings.

```solidity
mapping(address => mapping(address => uint256)) public allowance;
```

This is exactly how ERC-20 allowances work:
- outer key: token owner
- inner key: spender
- value: how much the spender is allowed to spend

```solidity
// owner approves spender for 100 tokens
allowance[owner][spender] = 100;

// read: how much can spender spend on behalf of owner?
uint256 allowed = allowance[owner][spender];

// spender uses some allowance
allowance[owner][spender] -= 50;
```

**Mapping of structs:**
```solidity
mapping(address => User) public users;
users[msg.sender].balance += 100; // access struct field directly
```

**Mapping of arrays:**
```solidity
mapping(address => uint256[]) public userOrders;
userOrders[msg.sender].push(orderId);
uint256 count = userOrders[msg.sender].length;
```

---

## 6. Choosing the Right Data Structure

| Situation | Use |
|-----------|-----|
| Look up a value by address/id instantly | `mapping` |
| Need to iterate over all entries | `array` |
| Need both lookup AND iteration | `mapping` + `array` (store keys in array) |
| Group related fields | `struct` |
| Track a finite set of states | `enum` |
| Per-user, per-token allowances | nested `mapping` |

### The mapping + array pattern

Since you can't iterate a mapping, store the keys in a parallel array:

```solidity
mapping(address => uint256) public balances;
address[] public holders;             // track all keys

function deposit() external payable {
    if (balances[msg.sender] == 0) {
        holders.push(msg.sender);     // add to list only if new
    }
    balances[msg.sender] += msg.value;
}

function getAllBalances() external view returns (address[] memory, uint256[] memory) {
    uint256[] memory amounts = new uint256[](holders.length);
    for (uint256 i = 0; i < holders.length; i++) {
        amounts[i] = balances[holders[i]];
    }
    return (holders, amounts);
}
```

---

## 7. Full Example — Student Registry

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error AlreadyEnrolled(address student);
error NotEnrolled(address student);
error InvalidGrade(uint256 grade);

contract StudentRegistry {
    enum Grade { F, D, C, B, A }

    struct Student {
        string name;
        uint256 score;    // 0-100
        Grade grade;
        bool enrolled;
    }

    mapping(address => Student) public students;
    address[] public studentList;
    address public immutable admin;

    constructor() {
        admin = msg.sender;
    }

    function enroll(address student, string calldata name) external {
        if (msg.sender != admin) revert NotEnrolled(student);
        if (students[student].enrolled) revert AlreadyEnrolled(student);

        students[student] = Student({
            name: name,
            score: 0,
            grade: Grade.F,
            enrolled: true
        });
        studentList.push(student);
    }

    function setScore(address student, uint256 score) external {
        if (msg.sender != admin) revert NotEnrolled(student);
        if (!students[student].enrolled) revert NotEnrolled(student);
        if (score > 100) revert InvalidGrade(score);

        Student storage s = students[student]; // storage pointer
        s.score = score;
        s.grade = _calculateGrade(score);
    }

    function _calculateGrade(uint256 score) private pure returns (Grade) {
        if (score >= 90) return Grade.A;
        if (score >= 80) return Grade.B;
        if (score >= 70) return Grade.C;
        if (score >= 60) return Grade.D;
        return Grade.F;
    }

    function totalStudents() external view returns (uint256) {
        return studentList.length;
    }
}
```

Notice:
- `enum Grade` — finite set of grade values
- `struct Student` — groups all student data
- `mapping(address => Student)` — instant lookup by address
- `address[] studentList` — parallel array to enable iteration
- `Student storage s` — pointer pattern to update multiple fields cheaply

---

## Summary

| Type | Key facts |
|------|-----------|
| `mapping` | Key-value, O(1) lookup, no iteration, default value = zero |
| `array` | Ordered, iterable, `push`/`pop`, `delete` resets not removes |
| `struct` | Groups fields, use storage pointer to update efficiently |
| `enum` | Named states, stored as uint8, self-documenting |
| nested mapping | `mapping(a => mapping(b => c))`, used in ERC-20 allowances |

---

→ **Practice Set P-S3** — Data structure exercises
→ After that: **S4: OOP in Solidity**
