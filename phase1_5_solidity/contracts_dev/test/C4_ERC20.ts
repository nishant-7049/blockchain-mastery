import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, maxUint256 } from "viem";

describe("ERC20 tests", async () => {
    const { viem } = await network.create();

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const token = await viem.deployContract("ERC20", ["MyToken", "MTK"]);
        return { token, clients, publicClient };
    }

    // --- constructor ---

    it("sets name, symbol, decimals correctly", async () => {
        const { token, publicClient } = await deploy();

        const name = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: "name" });
        const symbol = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: "symbol" });
        const decimals = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: "decimals" });

        assert.equal(name, "MyToken");
        assert.equal(symbol, "MTK");
        assert.equal(decimals, 18n);
    });

    // --- mint ---

    it("owner can mint tokens", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address,
            abi: token.abi,
            functionName: "mint",
            args: [clients[1].account.address, parseEther("100")],
        });

        const balance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[1].account.address],
        });
        const supply = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: "totalSupply" });

        assert.equal(balance, parseEther("100"));
        assert.equal(supply, parseEther("100"));
    });

    it("non-owner cannot mint", async () => {
        const { token, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: token.address, abi: token.abi, functionName: "mint",
                args: [clients[1].account.address, parseEther("100")],
                account: clients[1].account,
            })
        );
    });

    // --- transfer ---

    it("transfer moves tokens between accounts", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "mint",
            args: [clients[0].account.address, parseEther("100")],
        });

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "transfer",
            args: [clients[1].account.address, parseEther("40")],
        });

        const senderBalance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[0].account.address],
        });
        const receiverBalance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        assert.equal(senderBalance, parseEther("60"));
        assert.equal(receiverBalance, parseEther("40"));
    });

    it("transfer reverts on insufficient balance", async () => {
        const { token, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: token.address, abi: token.abi, functionName: "transfer",
                args: [clients[1].account.address, parseEther("1")],
                account: clients[0].account,
            })
        );
    });

    // --- approve + transferFrom ---

    it("approve sets allowance", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, parseEther("50")],
        });

        const allowed = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "allowance",
            args: [clients[0].account.address, clients[1].account.address],
        });

        assert.equal(allowed, parseEther("50"));
    });

    it("approve overwrites previous allowance", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, parseEther("50")],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, parseEther("20")],
        });

        const allowed = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "allowance",
            args: [clients[0].account.address, clients[1].account.address],
        });

        assert.equal(allowed, parseEther("20"), "Allowance must be overwritten not added");
    });

    it("transferFrom spends allowance and moves tokens", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "mint",
            args: [clients[0].account.address, parseEther("100")],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, parseEther("50")],
        });

        await clients[1].writeContract({
            address: token.address, abi: token.abi, functionName: "transferFrom",
            args: [clients[0].account.address, clients[2].account.address, parseEther("30")],
        });

        const fromBalance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[0].account.address],
        });
        const toBalance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[2].account.address],
        });
        const remaining = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "allowance",
            args: [clients[0].account.address, clients[1].account.address],
        });

        assert.equal(fromBalance, parseEther("70"));
        assert.equal(toBalance, parseEther("30"));
        assert.equal(remaining, parseEther("20"), "Allowance must decrease after spend");
    });

    it("transferFrom with infinite allowance does not reduce allowance", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "mint",
            args: [clients[0].account.address, parseEther("100")],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, maxUint256],
        });

        await clients[1].writeContract({
            address: token.address, abi: token.abi, functionName: "transferFrom",
            args: [clients[0].account.address, clients[2].account.address, parseEther("50")],
        });

        const allowanceAfter = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "allowance",
            args: [clients[0].account.address, clients[1].account.address],
        });

        assert.equal(allowanceAfter, maxUint256, "Infinite allowance must not decrease");
    });

    it("transferFrom reverts when allowance exceeded", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "mint",
            args: [clients[0].account.address, parseEther("100")],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "approve",
            args: [clients[1].account.address, parseEther("10")],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: token.address, abi: token.abi, functionName: "transferFrom",
                args: [clients[0].account.address, clients[2].account.address, parseEther("20")],
                account: clients[1].account,
            })
        );
    });

    // --- burn ---

    it("burn reduces balance and totalSupply", async () => {
        const { token, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi, functionName: "mint",
            args: [clients[1].account.address, parseEther("100")],
        });

        await clients[1].writeContract({
            address: token.address, abi: token.abi, functionName: "burn",
            args: [parseEther("40")],
        });

        const balance = await publicClient.readContract({
            address: token.address, abi: token.abi, functionName: "balanceOf",
            args: [clients[1].account.address],
        });
        const supply = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: "totalSupply" });

        assert.equal(balance, parseEther("60"));
        assert.equal(supply, parseEther("60"));
    });

    it("burn reverts on insufficient balance", async () => {
        const { token, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: token.address, abi: token.abi, functionName: "burn",
                args: [parseEther("1")],
                account: clients[1].account,
            })
        );
    });
});
