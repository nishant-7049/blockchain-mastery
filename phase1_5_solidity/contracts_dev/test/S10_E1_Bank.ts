import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("Bank - Reentrancy", async function () {
  // create an isolated hardhat network for this test suite
  const { viem } = await network.create();

  it("attacker drains more than their deposit on broken Bank", async function () {
    // getWalletClients gives us test accounts with ETH pre-loaded
    const [deployer, victim] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    // deploy the vulnerable bank
    const bank = await viem.deployContract("Bank");

    // victim sends 5 ETH directly to bank (bank has receive() so it accepts it)
    await victim.sendTransaction({
      to: bank.address,
      value: parseEther("5"),
    });

    // deploy the attacker contract, telling it which bank to attack
    const attacker = await viem.deployContract("BankAttacker", [bank.address]);

    // call attack() with 1 ETH — deployer.writeContract lets us pass value for payable functions
    await deployer.writeContract({
      address: attacker.address,
      abi: attacker.abi,
      functionName: "attack",
      value: parseEther("1"),
    });

    // check how much ETH the attacker contract holds after the attack
    const attackerBalance = await publicClient.getBalance({ address: attacker.address });

    // attacker should have stolen more than their original 1 ETH deposit
    assert.ok(
      attackerBalance > parseEther("1"),
      `Expected attacker to have > 1 ETH but got ${attackerBalance}`
    );
  });
  
  it("attacker drains more than their deposit on fixed Bank", async function () {

    const [deployer, victim] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const fixedBank = await viem.deployContract("FixedBank");

    await victim.sendTransaction({
      to: fixedBank.address,
      value: parseEther("5")
    })

    const attacker = await viem.deployContract("BankAttacker", [fixedBank.address]);

    // attack should revert
      await assert.rejects(
          deployer.writeContract({
              address: attacker.address,
              abi: attacker.abi,
              functionName: "attack",
              value: parseEther("1"),
          })
      );

      // bank still has all 5 ETH — nothing stolen
      const bankBalance = await publicClient.getBalance({ address: fixedBank.address });
      assert.equal(bankBalance, parseEther("5"));
  })
});
