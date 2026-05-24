import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, encodeFunctionData } from "viem";

describe("MultiSigWallet tests", async () => {
    const { viem } = await network.create();

    async function deploy(ownerCount = 3) {
        const clients = await viem.getWalletClients();
        const ownerAddresses = clients.slice(0, ownerCount).map(c => c.account.address);
        const wallet = await viem.deployContract("MultiSigWallet", [ownerAddresses]);
        const publicClient = await viem.getPublicClient();
        return { wallet, clients, publicClient };
    }

    // --- constructor ---

    it("sets owners correctly on deploy", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        for (let i = 0; i < 3; i++) {
            const isOwner = await publicClient.readContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "isOwner",
                args: [clients[i].account.address],
            });
            assert.equal(isOwner, true, `clients[${i}] must be an owner`);
        }

        const isOwner = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "isOwner",
            args: [clients[3].account.address],
        });
        assert.equal(isOwner, false, "non-owner must not be an owner");
    });

    // --- receive ---

    it("accepts ETH", async () => {
        const { wallet, clients, publicClient } = await deploy();

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });

        const balance = await publicClient.getBalance({ address: wallet.address });
        assert.equal(balance, parseEther("1"));
    });

    it("rejects zero ETH send", async () => {
        const { wallet, clients } = await deploy();

        await assert.rejects(
            clients[0].sendTransaction({ to: wallet.address, value: 0n })
        );
    });

    // --- propose ---

    it("owner can propose a transaction", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });

        const txn = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "transactions",
            args: [0n],
        });

        assert.equal(txn[3], false);
        assert.equal(txn[4], 1n, "Proposer auto-confirms");
    });

    it("non-owner cannot propose", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "propose",
                args: [clients[3].account.address, parseEther("0.5"), "0x01"],
                account: clients[3].account,
            })
        );
    });

    it("proposal auto-executes when single owner reaches threshold", async () => {
        const { wallet, clients, publicClient } = await deploy(1);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });

        const balanceBefore = await publicClient.getBalance({ address: clients[1].account.address });

        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[1].account.address, parseEther("0.5"), "0x01"],
        });

        const balanceAfter = await publicClient.getBalance({ address: clients[1].account.address });
        assert(balanceAfter > balanceBefore, "Single owner wallet must execute immediately");
    });

    // --- confirm ---

    it("executes when confirmation threshold is reached", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });

        const recipient = clients[3].account.address;
        const balanceBefore = await publicClient.getBalance({ address: recipient });

        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [recipient, parseEther("0.5"), "0x01"],
        });

        // 1 confirmation so far — not enough for 3 owners
        let txn = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "transactions",
            args: [0n],
        });
        assert.equal(txn[3], false);

        // 2nd confirmation — threshold met (owners.length/2 = 1, need > 1)
        await clients[1].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "confirm",
            args: [0n],
        });

        const balanceAfter = await publicClient.getBalance({ address: recipient });
        assert(balanceAfter > balanceBefore, "Recipient must have received ETH");

        txn = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "transactions",
            args: [0n],
        });
        assert.equal(txn[3], true);
    });

    it("owner cannot confirm twice", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "confirm",
                args: [0n],
                account: clients[0].account,
            })
        );
    });

    it("cannot confirm an already executed tx", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });
        await clients[1].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "confirm",
            args: [0n],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "confirm",
                args: [0n],
                account: clients[2].account,
            })
        );
    });

    it("cannot confirm expired transaction", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });

        // Advance time past expiryDuration (120 seconds)
        await (publicClient as any).request({ method: "evm_increaseTime", params: [121] });
        await (publicClient as any).request({ method: "evm_mine", params: [] });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "confirm",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    // --- revoke ---

    it("owner can revoke their confirmation", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });

        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "revoke",
            args: [0n],
        });

        const txn = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "transactions",
            args: [0n],
        });
        assert.equal(txn[4], 0n, "Count must drop to 0 after revoke");
    });

    it("cannot revoke without having confirmed", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        await clients[0].sendTransaction({ to: wallet.address, value: parseEther("1") });
        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [clients[3].account.address, parseEther("0.5"), "0x01"],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: wallet.address,
                abi: wallet.abi,
                functionName: "revoke",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    // --- addOwner via multisig ---

    it("adds a new owner via multisig", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        const newOwner = clients[3].account.address;
        const data = encodeFunctionData({
            abi: wallet.abi,
            functionName: "addOwner",
            args: [newOwner],
        });

        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [wallet.address, 0n, data],
        });

        await clients[1].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "confirm",
            args: [0n],
        });

        const isOwner = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "isOwner",
            args: [newOwner],
        });
        assert.equal(isOwner, true, "New owner must be added after multisig approval");
    });

    // --- removeOwner via multisig ---

    it("removes an owner via multisig", async () => {
        const { wallet, clients, publicClient } = await deploy(3);

        const data = encodeFunctionData({
            abi: wallet.abi,
            functionName: "removeOwner",
            args: [clients[2].account.address],
        });

        await clients[0].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "propose",
            args: [wallet.address, 0n, data],
        });

        await clients[1].writeContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "confirm",
            args: [0n],
        });

        const isOwner = await publicClient.readContract({
            address: wallet.address,
            abi: wallet.abi,
            functionName: "isOwner",
            args: [clients[2].account.address],
        });
        assert.equal(isOwner, false, "Removed owner must no longer be an owner");
    });
});
