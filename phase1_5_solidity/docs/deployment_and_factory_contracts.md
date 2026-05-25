# Deployment & Factory Contracts

---

## Part 1 — Deploying Contracts

### Local vs Testnet vs Mainnet

| Environment | What it is | Use for |
|---|---|---|
| **Hardhat local** | In-memory EVM, resets every run | Development, testing |
| **Testnet** (Sepolia, Mumbai) | Real network, fake ETH | Pre-production testing |
| **Mainnet** | Real network, real ETH | Production |

---

### Hardhat Ignition (Hardhat 3)

Ignition is Hardhat 3's deployment system. It tracks what was already deployed and won't redeploy unless you tell it to. Deployments are reproducible and resumable.

**Step 1 — Write an Ignition module**

```typescript
// ignition/modules/LendingProtocol.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LendingProtocolModule", (m) => {
    // deploy the borrow token first
    const token = m.contract("ERC20", ["USD Coin", "USDC"]);

    // deploy the lending protocol, passing the token address
    const lending = m.contract("LendingProtocol", [
        token,                    // address — Ignition resolves it automatically
        2000n * 10n ** 18n,       // ethPrice: 1 ETH = 2000 USDC
        1000000000000000n,        // interestPerSecond: ~0.1%/s
    ]);

    return { token, lending };
});
```

**Step 2 — Deploy**

```bash
# deploy to local hardhat node
npx hardhat ignition deploy ignition/modules/LendingProtocol.ts

# deploy to Sepolia testnet
npx hardhat ignition deploy ignition/modules/LendingProtocol.ts --network sepolia
```

Ignition saves deployment state in `ignition/deployments/` — if a contract is already deployed, it won't redeploy it.

---

### hardhat.config.ts — Network Setup

To deploy to a real network, add it to your config:

```typescript
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL ?? "",   // Infura / Alchemy URL
            accounts: process.env.PRIVATE_KEY          // deployer wallet
                ? [process.env.PRIVATE_KEY]
                : [],
        },
    },
};

export default config;
```

Store secrets in a `.env` file (never commit to git):

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id
PRIVATE_KEY=0xabc123...
```

Use `dotenv` to load them:
```bash
npm install dotenv
```

```typescript
import "dotenv/config";   // add at top of hardhat.config.ts
```

---

### Getting Testnet ETH

You need testnet ETH to pay gas. Get it free from faucets:
- Sepolia: https://sepoliafaucet.com or https://faucet.quicknode.com/ethereum/sepolia
- Request ETH → wait ~1 minute → check your wallet

---

### Verifying Contracts on Etherscan

After deploying, verify the source code so anyone can read it:

```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS "constructor_arg1" "constructor_arg2"
```

Add your Etherscan API key to `hardhat.config.ts`:
```typescript
etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
}
```

---

## Part 2 — Factory Contracts

A factory is a **contract that deploys other contracts**. Instead of you deploying manually, users or the protocol can trigger deployments on-chain.

Real world examples:
- **Uniswap V2** — `UniswapV2Factory` deploys a new pair pool for every token pair
- **Aave** — factory deploys isolated lending markets
- **Token launchpads** — factory deploys a new ERC-20 for each project

---

### Pattern 1 — `new` Keyword (Simple Factory)

The most straightforward way. Solidity's `new` keyword deploys a contract from within a contract.

```solidity
contract DexFactory {
    // track all deployed pools
    address[] public allPools;
    mapping(address => mapping(address => address)) public getPool;

    event PoolCreated(address indexed tokenA, address indexed tokenB, address pool);

    function createPool(address tokenA, address tokenB, uint256 feeBps) external returns (address) {
        require(tokenA != tokenB, "Same token");
        require(getPool[tokenA][tokenB] == address(0), "Pool exists");

        // deploys a full new SimpleDex contract
        SimpleDex pool = new SimpleDex(tokenA, tokenB, feeBps);

        // register in both directions
        getPool[tokenA][tokenB] = address(pool);
        getPool[tokenB][tokenA] = address(pool);
        allPools.push(address(pool));

        emit PoolCreated(tokenA, tokenB, address(pool));
        return address(pool);
    }

    function totalPools() external view returns (uint256) {
        return allPools.length;
    }
}
```

**How it works:**
1. User calls `createPool(USDC, WETH, 30)`
2. Factory deploys a new `SimpleDex` contract on-chain
3. Records the address so anyone can look it up
4. Returns the pool address

**Drawback:** Every deployment costs full gas for the bytecode (~500k-1M gas). If SimpleDex is large, this is expensive.

---

### Pattern 2 — `CREATE2` (Deterministic Addresses)

Normal `new` gives you an unpredictable address (based on nonce). `CREATE2` lets you **compute the address before deployment** — it's determined by:

```
address = hash(0xFF, factory_address, salt, keccak256(bytecode))
```

```solidity
contract DexFactory {
    mapping(address => mapping(address => address)) public getPool;

    function createPool(address tokenA, address tokenB, uint256 feeBps) external returns (address) {
        // salt is derived from the token pair — same tokens always give same salt
        bytes32 salt = keccak256(abi.encodePacked(tokenA, tokenB));

        // deploy with CREATE2
        SimpleDex pool = new SimpleDex{salt: salt}(tokenA, tokenB, feeBps);

        getPool[tokenA][tokenB] = address(pool);
        return address(pool);
    }

    // compute pool address WITHOUT deploying — just math
    function computePoolAddress(address tokenA, address tokenB, uint256 feeBps) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(tokenA, tokenB));
        bytes memory bytecode = abi.encodePacked(
            type(SimpleDex).creationCode,
            abi.encode(tokenA, tokenB, feeBps)
        );
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(bytecode)
        )))));
    }
}
```

**Why this matters:**
- You can tell users the pool address before it exists
- Uniswap V2 uses this — your router can compute pair addresses without making RPC calls
- Used in **counterfactual deployments** — send ETH to an address that doesn't exist yet, deploy later

---

### Pattern 3 — Minimal Proxy / Clone (EIP-1167)

The cheapest factory pattern. Instead of deploying the full contract bytecode each time, deploy a tiny 45-byte **proxy** that delegates all calls to one shared **implementation** contract.

```
Every clone (45 bytes)
    ↓ delegatecall
Implementation (full bytecode, deployed once)
```

Because of `delegatecall`, each clone has its **own storage** but shares the implementation's logic.

**The catch:** The implementation contract cannot have a constructor that sets state (since clones skip the constructor). Instead, use an `initialize` function.

```solidity
// Implementation contract — logic lives here, deployed ONCE
contract SimpleDexImpl {
    address public tokenA;
    address public tokenB;
    uint256 public feeBps;
    bool private initialized;

    // called instead of constructor
    function initialize(address _tokenA, address _tokenB, uint256 _feeBps) external {
        require(!initialized, "Already initialized");
        initialized = true;
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeBps = _feeBps;
    }

    // ... rest of DEX logic
}

// Factory — deploys cheap clones
import "@openzeppelin/contracts/proxy/Clones.sol";

contract DexFactory {
    address public immutable implementation;
    address[] public allPools;

    event PoolCreated(address indexed tokenA, address indexed tokenB, address pool);

    constructor() {
        // deploy implementation once at factory creation
        implementation = address(new SimpleDexImpl());
    }

    function createPool(address tokenA, address tokenB, uint256 feeBps) external returns (address) {
        // deploy a 45-byte proxy pointing to implementation
        address pool = Clones.clone(implementation);

        // initialize state on the clone (since constructor was skipped)
        SimpleDexImpl(pool).initialize(tokenA, tokenB, feeBps);

        allPools.push(pool);
        emit PoolCreated(tokenA, tokenB, pool);
        return pool;
    }

    // clone with deterministic address (CREATE2 + clone combined)
    function createPoolDeterministic(address tokenA, address tokenB, uint256 feeBps) external returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(tokenA, tokenB));
        address pool = Clones.cloneDeterministic(implementation, salt);
        SimpleDexImpl(pool).initialize(tokenA, tokenB, feeBps);
        return pool;
    }
}
```

**Gas comparison** (deploying 10 pools):

| Pattern | Gas per deploy | Total (10 pools) |
|---|---|---|
| `new` | ~600,000 | ~6,000,000 |
| Clone | ~50,000 | ~500,000 |
| Difference | **12x cheaper** | saves ~5.5M gas |

---

### Pattern Comparison

| | `new` | `CREATE2` | Clone |
|---|---|---|---|
| Address predictable? | ❌ | ✅ | ❌ (unless `cloneDeterministic`) |
| Gas cost | High | High | Very low |
| Shared logic? | No | No | Yes (delegatecall) |
| Constructor params? | ✅ | ✅ | ❌ (use `initialize`) |
| Complexity | Low | Medium | Medium |
| Use when | Simple, few deploys | Need predictable address | Many deploys, same logic |

---

### Real World: How Uniswap V2 Uses This

```
UniswapV2Factory
    createPair(tokenA, tokenB)
        → deploys UniswapV2Pair via CREATE2
        → salt = keccak256(tokenA, tokenB) sorted
        → anyone can compute pair address with: UniswapV2Library.pairFor(factory, tokenA, tokenB)

UniswapV2Router
    → never stores pair addresses
    → just computes them on the fly using the formula
    → calls the pair directly
```

This is why Uniswap is so gas efficient — the router never needs to ask the factory for addresses. It just does math.
