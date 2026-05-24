import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Counter tests", async ()=> {

    const {viem} = await network.create();

    it("checks increment", async ()=> {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        const oldCount = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        })
        assert.equal(oldCount, 0n, "Count must have been started by 0");

        await user.writeContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "increment"
        })

        const newCount = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        })

        assert.equal(newCount, 1n, "Count must have been increased");
    })

    it("checks reset", async() => {
        const [owner, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        const oldCount = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        })
        assert.equal(oldCount, 0n, "Count must have been started by 0");

        await user.writeContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "increment"
        })

        const newCount = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        })

        assert.equal(newCount, 1n, "Count must have been increased");

        await owner.writeContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "reset"
        })
        const newCount1 = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        })

        assert.equal(newCount1, 0n, "Count must have been reset");
    })

    it("checks owner only reset", async ()=> {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        await assert.rejects(
            publicClient.simulateContract({
                address: counter.address,
                abi: counter.abi,
                functionName: "reset",
                account: user.account,
            })
        );
    })

    it("increments multiple times correctly", async () => {
        const [, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        await user.writeContract({ address: counter.address, abi: counter.abi, functionName: "increment" });
        await user.writeContract({ address: counter.address, abi: counter.abi, functionName: "increment" });
        await user.writeContract({ address: counter.address, abi: counter.abi, functionName: "increment" });

        const count = await publicClient.readContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "count"
        });

        assert.equal(count, 3n, "Count must be 3 after 3 increments");
    });

    it("emits Incremented event with correct args", async () => {
        const [owner, user] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        await user.writeContract({
            address: counter.address,
            abi: counter.abi,
            functionName: "increment"
        });

        const events = await publicClient.getContractEvents({
            address: counter.address,
            abi: counter.abi,
            eventName: "Incremented",
        });

        assert.equal(events.length, 1, "Must emit exactly one Incremented event");
        assert.equal(events[0].args.user?.toLowerCase(), user.account.address.toLowerCase(), "Event must log the caller");
        assert.equal(events[0].args.currentCount, 1n, "Event must log the new count");
    });

    it("emits Reset event", async () => {
        const [owner] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const counter = await viem.deployContract("Counter");

        await owner.writeContract({ address: counter.address, abi: counter.abi, functionName: "increment" });
        await owner.writeContract({ address: counter.address, abi: counter.abi, functionName: "reset" });

        const events = await publicClient.getContractEvents({
            address: counter.address,
            abi: counter.abi,
            eventName: "Reset",
        });

        assert.equal(events.length, 1, "Must emit exactly one Reset event");
    });
})
