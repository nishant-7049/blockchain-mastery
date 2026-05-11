# S1: Solidity Basics — Variables, Types, Functions, Visibility, Storage Locations

---

## What is Solidity?

Solidity is the programming language for writing smart contracts on the EVM.

```
High-level language  →  Solidity compiler (solc)  →  EVM bytecode
(human readable)                                      (machine readable)

Like:
  JavaScript  →  V8 engine     →  machine code
  Solidity    →  solc compiler →  EVM opcodes
```

Solidity is:
- **Statically typed** — every variable has a type declared at compile time
- **Contract-oriented** — code lives inside `contract` blocks (like classes)
- **Compiled** — not interpreted, compiles to bytecode before deployment
- **Deterministic** — same inputs always produce same outputs (required for consensus)

---

## 1. Your First Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyFirstContract {
    // state variable — stored permanently on chain
    uint256 public number;

    // function — changes state
    function setNumber(uint256 _number) public {
        number = _number;
    }

    // function — reads state
    function getNumber() public view returns (uint256) {
        return number;
    }
}
```

Breaking this down line by line:

```
// SPDX-License-Identifier: MIT
  License declaration. Required by compiler.
  MIT = open source, anyone can use.

pragma solidity ^0.8.0;
  "Use Solidity version 0.8.0 or higher but below 0.9.0"
  ^ means compatible with patch versions.
  This line must appear in every file.

contract MyFirstContract { }
  Defines a contract. Like a class in OOP.
  Everything inside { } belongs to this contract.

uint256 public number;
  State variable. Stored permanently on-chain.
  uint256 = unsigned integer, 256 bits.
  public = anyone can read it (auto-generates a getter).

function setNumber(uint256 _number) public { }
  Function that changes state.
  _number = parameter (underscore prefix is convention for params).
  public = anyone can call it.

function getNumber() public view returns (uint256) { }
  view = this function only READS state, does not change it.
  returns (uint256) = declares what type it returns.
```

---

## 2. Value Types

These are stored directly in variables (like primitives in other languages).

### Integers

```solidity
// Unsigned integers (no negative)
uint8   x = 255;          // 0 to 255
uint16  y = 65535;         // 0 to 65,535
uint32  z = 4294967295;    // 0 to ~4.2 billion
uint256 n = 1e18;          // 0 to 2^256-1 (most common)

// uint is alias for uint256
uint amount = 1000;

// Signed integers (can be negative)
int256 temperature = -10;
int8   small = -128;       // -128 to 127

// Arithmetic
uint256 a = 10;
uint256 b = 3;
uint256 sum  = a + b;   // 13
uint256 diff = a - b;   // 7
uint256 prod = a * b;   // 30
uint256 quot = a / b;   // 3 (integer division, truncates)
uint256 rem  = a % b;   // 1 (remainder)
uint256 pow  = a ** b;  // 1000 (exponentiation)
```

Important — overflow protection in Solidity >= 0.8.0:

```solidity
uint8 x = 255;
x = x + 1;  // REVERTS with arithmetic overflow (not wraps around)
             // This is the fix from 1.8 — automatic in modern Solidity
```

### Boolean

```solidity
bool isActive = true;
bool isPaused = false;

// Operators
bool a = true && false;   // AND → false
bool b = true || false;   // OR  → true
bool c = !true;           // NOT → false
bool d = (5 > 3);         // comparison → true
```

### Address

The most blockchain-specific type. Stores a 20-byte Ethereum address.

```solidity
address owner = 0x742d35Cc6634C0532925a3b8D4C5bB1234567890;

// address has built-in properties
uint256 bal = owner.balance;    // ETH balance in wei

// address payable — can receive ETH
address payable recipient = payable(owner);
recipient.transfer(1 ether);   // send ETH to this address
```

```
address vs address payable:

  address:         can READ balance, CANNOT receive ETH
  address payable: can READ balance, CAN receive ETH (transfer/send/call)

  Convert: address payable p = payable(someAddress);
```

### Bytes

```solidity
bytes32 hash = keccak256(abi.encodePacked("hello"));
bytes1  b    = 0xFF;

// bytes32 is the most common — used for hashes
// Fixed size. Cheaper than string for fixed-length data.
```

### String

```solidity
string name = "Alice";
string greeting = "Hello, World!";

// Strings are dynamic size — stored differently
// Cannot compare strings directly with ==
// Use keccak256 hash comparison:
bool same = keccak256(abi.encodePacked(name)) ==
            keccak256(abi.encodePacked("Alice")); // true
```

---

## 3. State Variables vs Local Variables

This is critical to understand:

```solidity
contract Example {
    // STATE VARIABLE — lives on the blockchain permanently
    uint256 public count;          // stored in contract storage
    address public owner;          // stored in contract storage

    function doSomething() public {
        // LOCAL VARIABLE — lives only during this function call
        uint256 temp = count + 1;  // in memory, gone after function ends
        bool flag = true;          // in memory, gone after function ends

        count = temp;              // write local value back to state
    }
}
```

```
State variables:
  → Stored on the blockchain (in contract storage)
  → Persist between function calls
  → Cost gas to write (SSTORE = 20,000 gas)
  → Cheap to read (SLOAD = 2,100 gas)

Local variables:
  → Exist only during the function execution
  → Stored in memory or stack
  → No gas cost for memory (tiny cost)
  → Gone when function finishes
```

---

## 4. Storage Locations — storage, memory, calldata

Solidity has THREE places where data can live.
Understanding this is essential.

### storage

```solidity
contract Example {
    uint256[] public numbers;   // ← this array is in STORAGE

    function addNumber(uint256 n) public {
        numbers.push(n);        // modifies storage array → costs gas
    }
}
```

```
storage:
  → Permanent. Lives on the blockchain forever.
  → Expensive to write. Cheap to read.
  → All state variables are in storage by default.
  → Think: hard drive of the EVM.
```

### memory

```solidity
function processNames(string[] memory names) public pure returns (string memory) {
    string memory result = names[0];   // temporary copy in memory
    return result;
}
```

```
memory:
  → Temporary. Exists only during the function call.
  → Much cheaper than storage.
  → Must be explicitly declared for reference types (arrays, structs, strings)
    inside functions.
  → Think: RAM of the EVM.
```

### calldata

```solidity
function processNames(string[] calldata names) public pure returns (uint256) {
    return names.length;
}
```

```
calldata:
  → Read-only. The raw input data of the transaction.
  → Cheapest of the three (no copying).
  → Can only be used for function parameters.
  → Cannot be modified.
  → Use for external function parameters when you don't need to modify them.
  → Think: the message received, you can read it but not change it.
```

### When to Use Which

```
Rule of thumb:

  State variables              → storage (automatic)
  Function parameters          → calldata (if external + read-only)
                                  memory (if you need to modify)
  Local variables (value types)→ stack (automatic, uint/bool/address)
  Local variables (ref types)  → memory (must declare explicitly)

Example:
  function expensive(uint256[] memory data) public { }   // copies to memory
  function cheap(uint256[] calldata data) external { }   // no copy, read-only
  
  Use calldata whenever possible for external functions.
  Saves gas — no copying needed.
```

### The Storage Pointer Trap

```solidity
contract StorageTrap {
    uint256[] public numbers;

    function wrongWay() public {
        uint256[] storage myArray = numbers;  // POINTER to storage
        myArray.push(99);    // THIS MODIFIES numbers!
        // storage reference modifies the original
    }

    function rightWay() public {
        uint256[] memory myArray = numbers;   // COPY into memory
        myArray.push(99);    // only modifies the copy
        // numbers is untouched
    }
}
```

```
storage reference = pointer (modifies original)
memory copy       = copy (independent from original)

This is one of the most common bugs for Solidity beginners.
```

---

## 5. Function Visibility

Every function must declare who can call it:

```solidity
contract Visibility {

    // PUBLIC: anyone can call — external accounts AND other contracts
    function publicFn() public { }

    // PRIVATE: only THIS contract can call — not even child contracts
    function privateFn() private { }

    // INTERNAL: this contract AND child contracts (inherited)
    function internalFn() internal { }

    // EXTERNAL: only external accounts and other contracts
    //           CANNOT be called internally (cheaper than public for params)
    function externalFn() external { }
}
```

```
Visibility    | Same contract | Child contract | External
──────────────┼───────────────┼────────────────┼──────────
public        |      ✓        |       ✓        |    ✓
private       |      ✓        |       ✗        |    ✗
internal      |      ✓        |       ✓        |    ✗
external      |      ✗        |       ✗        |    ✓
```

State variable visibility:

```solidity
uint256 public   count;    // auto-generates getter function
uint256 private  secret;   // only this contract can read
uint256 internal shared;   // this + child contracts
// no "external" for state variables
```

---

## 6. Function State Mutability

Besides visibility, functions declare how they interact with state:

```solidity
contract Mutability {
    uint256 public value = 10;

    // Changes state — costs gas (writes to blockchain)
    function setValue(uint256 _v) public {
        value = _v;
    }

    // VIEW: reads state, does not change it — FREE if called externally
    function getValue() public view returns (uint256) {
        return value;
    }

    // PURE: doesn't read OR write state — just computation
    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;
    }

    // PAYABLE: can receive ETH — without this, sending ETH reverts
    function deposit() public payable {
        // msg.value = amount of ETH sent with this call
    }
}
```

```
(none)   → reads and writes state → costs gas
view     → reads state only → free when called externally (off-chain)
pure     → no state interaction → free when called externally
payable  → can receive ETH → requires payable keyword

Gas cost:
  view/pure called off-chain (read-only JSON-RPC call) → FREE
  view/pure called from another contract on-chain → costs gas
  state-changing functions → always costs gas
```

---

## 7. Function Parameters and Return Values

```solidity
contract Functions {

    // Single return value
    function double(uint256 x) public pure returns (uint256) {
        return x * 2;
    }

    // Multiple return values
    function minMax(uint256 a, uint256 b) public pure returns (uint256 min, uint256 max) {
        if (a < b) {
            return (a, b);
        } else {
            return (b, a);
        }
    }

    // Named return values (can omit return statement)
    function calculate(uint256 x) public pure returns (uint256 result) {
        result = x * x;   // assign to named return variable
        // implicit return of 'result'
    }

    // Calling functions and unpacking multiple returns
    function useMinMax() public pure returns (uint256) {
        (uint256 lo, uint256 hi) = minMax(5, 3);
        return hi - lo;   // 5 - 3 = 2
    }
}
```

---

## 8. Constructor

A constructor runs ONCE when the contract is deployed.
Used for initialization.

```solidity
contract Token {
    string public name;
    string public symbol;
    address public owner;
    uint256 public totalSupply;

    // Runs once at deployment — never again
    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        owner = msg.sender;   // whoever deployed the contract
    }
}
```

```
Deploying this contract:
  new Token("MyToken", "MTK", 1000000)

After deployment:
  name        = "MyToken"
  symbol      = "MTK"
  totalSupply = 1000000
  owner       = address of deployer

Constructor code is NOT stored in the contract.
It runs during deployment and is discarded.
```

---

## 9. Global Variables — msg, block, tx

These are built-in variables available in every function:

```solidity
contract Globals {
    function whoCalledMe() public view returns (address) {
        return msg.sender;    // address that called THIS function
    }

    function howMuchETH() public payable returns (uint256) {
        return msg.value;     // ETH sent with this call (in wei)
    }

    function currentBlock() public view returns (uint256) {
        return block.number;    // current block height
    }

    function currentTime() public view returns (uint256) {
        return block.timestamp; // unix timestamp of current block
    }

    function whoMadeThisTx() public view returns (address) {
        return tx.origin;       // original signer (DANGEROUS — avoid)
    }
}
```

```
msg.sender    → who is calling this function RIGHT NOW
              (could be a user OR another contract)
msg.value     → how much ETH was sent (in wei)
msg.data      → raw calldata bytes

block.number    → current block height
block.timestamp → when this block was mined (unix seconds)
block.basefee   → current base fee (EIP-1559)

tx.origin     → original transaction signer (always an EOA)
              → NEVER use for auth (from 1.8: tx.origin attack)
tx.gasprice   → gas price of current transaction
```

---

## 10. Units

Solidity has built-in units to avoid mistakes:

```solidity
// Ether units
uint256 a = 1 ether;      // 1e18 wei
uint256 b = 1 gwei;       // 1e9 wei
uint256 c = 1 wei;        // 1 (base unit)

// All the same: 1 ETH = 10^18 wei
assert(1 ether == 1e18);
assert(1 ether == 1000000000 gwei);

// Time units
uint256 oneMinute  = 1 minutes;   // 60
uint256 oneHour    = 1 hours;     // 3600
uint256 oneDay     = 1 days;      // 86400
uint256 oneWeek    = 1 weeks;     // 604800

// Usage example
uint256 lockUntil = block.timestamp + 7 days;
```

---

## 11. Type Conversion

```solidity
// Implicit conversion (safe, smaller to larger)
uint8  small = 255;
uint256 large = small;   // OK — no data loss

// Explicit conversion (you take responsibility)
uint256 big = 1000;
uint8  tiny = uint8(big);  // truncates — tiny = 232 (1000 % 256)
                            // DANGEROUS if value doesn't fit

// address conversions
address addr = 0x742d35Cc6634C0532925a3b8D4C5bB1234567890;
address payable p = payable(addr);   // cast to payable
uint256 asNum = uint256(uint160(addr));  // address to number
```

---

## 12. Putting It All Together — A Real Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleBank {
    // State variables — stored on chain
    address public owner;
    mapping(address => uint256) public balances;   // we'll cover mappings in S3

    // Events — we'll cover in S7, but here for completeness
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // Constructor — runs once at deployment
    constructor() {
        owner = msg.sender;
    }

    // Accept ETH deposits
    function deposit() public payable {
        require(msg.value > 0, "Send some ETH");    // we'll cover in S2
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // Withdraw your ETH
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // CEI pattern from 1.8 — state first, then external call
        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    // View your balance
    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }

    // Owner can check contract's total ETH
    function contractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
```

---

## Key Takeaways

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Types        → uint256, bool, address, bytes32, string     │
│                 Value types stored directly.                 │
│                                                              │
│  Variables    → State (on-chain, permanent) vs              │
│                 Local (in-function, temporary).              │
│                                                              │
│  Locations    → storage (permanent, expensive)              │
│                 memory (temporary, cheaper)                  │
│                 calldata (read-only, cheapest)               │
│                                                              │
│  Visibility   → public / private / internal / external      │
│                 Controls WHO can call a function.            │
│                                                              │
│  Mutability   → (none) / view / pure / payable              │
│                 Controls HOW a function interacts with state.│
│                                                              │
│  Globals      → msg.sender, msg.value, block.timestamp      │
│                 Built-in context about current call/block.   │
│                                                              │
│  Units        → 1 ether = 1e18 wei. 1 days = 86400.        │
│                 Use units to avoid hardcoding magic numbers. │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Next

→ **Practice Set P-S1** — Variables and types exercises
→ After that: **S2: Control Flow** — if/else, loops, require/revert/assert
