# P-S10 — Security Patterns Practice Set

Each exercise gives you a vulnerable contract. Your job:
1. Identify the vulnerability
2. Fix it in a new file (e.g. `E1_SafeBank.sol`)
3. Write a Hardhat test that proves the attack works on the broken version, then proves the fix stops it

Copy contracts into `contracts_dev/contracts/` and tests into `contracts_dev/test/` to run them.

---

## Exercise 1 — Reentrancy

Find the vulnerability, fix it, and write a test with an `Attacker` contract.

```solidity
contract Bank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] = 0;
    }

    receive() external payable {}
}
```

**Your test must:**
- Deploy `Bank` with 10 ETH total deposits from normal users
- Show attacker drains more than their deposit using the broken version
- Show attacker only gets their own deposit back using the fixed version

---

## Exercise 2 — DoS via Push Payments

Find the vulnerability and rewrite using the pull pattern.

```solidity
contract Splitter {
    address[] public recipients;
    mapping(address => uint256) public shares;

    function addRecipient(address user, uint256 share) external {
        recipients.push(user);
        shares[user] = share;
    }

    function distribute() external payable {
        require(msg.value > 0);
        for (uint256 i = 0; i < recipients.length; i++) {
            (bool ok,) = payable(recipients[i]).call{value: shares[recipients[i]]}("");
            require(ok, "Transfer failed");
        }
    }
}
```

**Question:** How can a single malicious recipient permanently break `distribute()` for everyone else? Write a `MaliciousRecipient` contract that demonstrates this.

---

## Exercise 3 — Integer Underflow

This contract was written for Solidity 0.7. Find what breaks in 0.8, then find the logic bug that exists regardless of version.

```solidity
pragma solidity ^0.7.0;

contract TokenSale {
    mapping(address => uint256) public balances;
    uint256 public price = 1 ether;

    function buy(uint256 amount) external payable {
        require(msg.value == amount * price);
        balances[msg.sender] += amount;
    }

    function sell(uint256 amount) external {
        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount * price}("");
        require(ok);
    }
}
```

**Questions:**
1. What overflow/underflow was possible in 0.7 that 0.8 prevents?
2. What logic bug exists in `sell()` regardless of version?
3. Rewrite the contract correctly for `^0.8.20`

---

## Exercise 4 — tx.origin Phishing

The wallet below uses `tx.origin`. Write an `Attacker` contract that drains it, then fix the wallet.

```solidity
contract Wallet {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function transfer(address payable to, uint256 amount) external {
        require(tx.origin == owner, "Not owner");
        to.transfer(amount);
    }

    receive() external payable {}
}
```

**Your test must:**
- Deploy `Wallet` with 5 ETH
- Show attacker drains it via phishing (owner calls attacker contract)
- Show the fix prevents the drain

---

## Exercise 5 — Full Audit (Boss Exercise)

The contract below has **four vulnerabilities**. Find all of them, fix each one, and write a test for each fix.

```solidity
contract VulnerableVault {
    address public owner;
    mapping(address => uint256) public balances;
    address[] public depositors;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        if (balances[msg.sender] == 0) {
            depositors.push(msg.sender);
        }
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount);

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);

        balances[msg.sender] -= amount;
    }

    function withdrawAll() external {
        require(tx.origin == owner);
        payable(owner).transfer(address(this).balance);
    }

    function refundAll() external {
        for (uint256 i = 0; i < depositors.length; i++) {
            uint256 amount = balances[depositors[i]];
            balances[depositors[i]] = 0;
            (bool ok,) = payable(depositors[i]).call{value: amount}("");
            require(ok);
        }
    }
}
```

**List each vulnerability before fixing:**
1. Vulnerability: ___
2. Vulnerability: ___
3. Vulnerability: ___
4. Vulnerability: ___

---

## Test Structure Reference

Here's how a Hardhat test for a reentrancy attack looks:

```typescript
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Bank", function () {
    it("attacker drains more than deposit (broken version)", async function () {
        const [owner, victim, attackerEOA] = await ethers.getSigners();

        const Bank = await ethers.getContractFactory("Bank");
        const bank = await Bank.deploy();

        // victim deposits 5 ETH
        await bank.connect(victim).deposit({ value: ethers.parseEther("5") });

        const Attacker = await ethers.getContractFactory("Attacker");
        const attacker = await Attacker.deploy(bank.target);

        // attacker deposits 1 ETH then attacks
        await attacker.connect(attackerEOA).attack({ value: ethers.parseEther("1") });

        const stolen = await ethers.provider.getBalance(attacker.target);
        expect(stolen).to.be.gt(ethers.parseEther("1")); // stole more than deposited
    });
});
```

---

## Thinking Questions

Answer in comments at the top of your `E5` solution:

1. CEI protects against reentrancy. Why should you still add `nonReentrant` on top of CEI?
2. Why does the pull pattern fix DoS but introduce a new UX problem? What's the tradeoff?
3. In Exercise 3, `sell()` has a logic bug that exists even in 0.8 with no underflow. What is it?
4. A contract uses `nonReentrant` on `withdraw()` but not on `deposit()`. Can an attacker still exploit reentrancy? How?
