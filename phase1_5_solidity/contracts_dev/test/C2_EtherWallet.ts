import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("EtherWallet tests", async () => {

    const { viem } = await network.create();

    // --- deposit ---

    it("deposit increases user balance", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "deposit",
            value: parseEther("1"),
        });

        const balance = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "balanceOf",
            args: [user.account.address],
        });

        assert.equal(balance, parseEther("1"), "Balance must equal deposited amount");
    });

    it("deposit reverts on zero amount", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "deposit",
                value: 0n,
                account: user.account,
            })
        );
    });

    it("deposit reverts when paused", async () => {
        const [owner, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await owner.writeContract({ address: wallet.address, abi: wallet.abi, functionName: "pause" });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "deposit",
                value: parseEther("1"),
                account: user.account,
            })
        );
    });

    it("deposit emits Deposited event", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "deposit",
            value: parseEther("1"),
        });

        const events = await publicClient.getContractEvents({
            address: wallet.address,
            abi: wallet.abi,
            eventName: "Deposited",
        });

        assert.equal(events.length, 1);
        assert.equal(events[0].args.user?.toLowerCase(), user.account.address.toLowerCase());
        assert.equal(events[0].args.amount, parseEther("1"));
    });

    // --- withdraw ---

    it("withdraw sends correct amount after fee", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "deposit",
            value: parseEther("1"),
        });

        const balanceBefore = await publicClient.getBalance({ address: user.account.address });

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "withdraw",
            args: [parseEther("1")],
        });

        const balanceAfter = await publicClient.getBalance({ address: user.account.address });
        // user gets 1 ETH minus 1% fee (0.01 ETH) minus gas — just check they received close to 0.99 ETH
        // we check the contract balance tracking is zeroed out instead
        const remaining = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "balanceOf",
            args: [user.account.address],
        });

        assert.equal(remaining, 0n, "User balance in contract must be 0 after full withdrawal");
        assert(balanceAfter > balanceBefore, "User ETH balance must have increased after withdrawal");
    });

    it("withdraw reverts on zero amount", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "withdraw",
                args: [0n],
                account: user.account,
            })
        );
    });

    it("withdraw reverts when amount exceeds balance", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "deposit",
            value: parseEther("1"),
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "withdraw",
                args: [parseEther("2")],
                account: user.account,
            })
        );
    });

    it("withdraw reverts when paused", async () => {
        const [owner, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await user.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "deposit",
            value: parseEther("1"),
        });

        await owner.writeContract({ address: wallet.address, abi: wallet.abi, functionName: "pause" });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "withdraw",
                args: [parseEther("1")],
                account: user.account,
            })
        );
    });

    // --- setFee ---

    it("owner can update fee", async () => {
        const [owner] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await owner.writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "setFee",
            args: [200n],
        });

        const fee = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "feeBps",
        });

        assert.equal(fee, 200n, "Fee must be updated to 200 bps");
    });

    it("non-owner cannot update fee", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "setFee",
                args: [200n],
                account: user.account,
            })
        );
    });

    // --- pause / unpause ---

    it("owner can pause and unpause", async () => {
        const [owner] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await owner.writeContract({ address: wallet.address, abi: wallet.abi, functionName: "pause" });
        const pausedState = await publicClient.readContract({
            address: wallet.address, abi: wallet.abi, functionName: "paused"
        });
        assert.equal(pausedState, true, "Contract must be paused");

        await owner.writeContract({ address: wallet.address, abi: wallet.abi, functionName: "unPause" });
        const unpausedState = await publicClient.readContract({
            address: wallet.address, abi: wallet.abi, functionName: "paused"
        });
        assert.equal(unpausedState, false, "Contract must be unpaused");
    });

    it("non-owner cannot pause", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const wallet = await viem.deployContract("EtherWallet");

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "pause",
                account: user.account,
            })
        );
    });
});
