import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("VotingContract tests", async () => {
    const { viem } = await network.create();

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const contract = await viem.deployContract("VotingContract");
        return { contract, clients, publicClient };
    }

    async function advanceTime(publicClient: any, seconds: number) {
        await (publicClient as any).request({ method: "evm_increaseTime", params: [seconds] });
        await (publicClient as any).request({ method: "evm_mine", params: [] });
    }

    async function createProposal(contract: any, clients: any[], duration = 300) {
        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "createProposal",
            args: ["Test Proposal", "A test description", BigInt(duration)],
        });
    }

    async function registerVoter(contract: any, clients: any[], voterIndex: number, weight: bigint) {
        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "registerVoter",
            args: [clients[voterIndex].account.address, weight],
        });
    }

    // --- registerVoter ---

    it("owner can register a voter", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 10n);

        const voter = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "voters",
            args: [clients[1].account.address],
        });

        assert.equal(voter[0], true, "Voter must be registered");
        assert.equal(voter[1], 10n, "Voter weight must be 10");
    });

    it("non-owner cannot register a voter", async () => {
        const { contract, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "registerVoter",
                args: [clients[2].account.address, 10n],
                account: clients[1].account,
            })
        );
    });

    it("cannot register voter with zero weight", async () => {
        const { contract, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "registerVoter",
                args: [clients[1].account.address, 0n],
                account: clients[0].account,
            })
        );
    });

    // --- createProposal ---

    it("owner can create a proposal", async () => {
        const { contract, clients, publicClient } = await deploy();

        await createProposal(contract, clients, 300);

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals",
            args: [0n],
        });

        assert.equal(proposal[0], "Test Proposal", "Title must match");
        assert.equal(proposal[6], false, "Must not be finalized");
    });

    it("non-owner cannot create a proposal", async () => {
        const { contract, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "createProposal",
                args: ["Title", "Desc", 300n],
                account: clients[1].account,
            })
        );
    });

    // --- vote ---

    it("registered voter can cast a yes vote", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 10n);
        await createProposal(contract, clients);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote",
            args: [0n, 1], // Vote.Yes = 1
        });

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals", args: [0n],
        });

        assert.equal(proposal[3], 10n, "Yes votes must equal voter weight");
        assert.equal(proposal[5], 1n, "Voter count must be 1");
    });

    it("registered voter can cast a no vote", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 5n);
        await createProposal(contract, clients);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote",
            args: [0n, 2], // Vote.No = 2
        });

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals", args: [0n],
        });

        assert.equal(proposal[4], 5n, "No votes must equal voter weight");
    });

    it("unregistered voter cannot vote", async () => {
        const { contract, clients, publicClient } = await deploy();

        await createProposal(contract, clients);

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "vote",
                args: [0n, 1],
                account: clients[1].account,
            })
        );
    });

    it("voter cannot vote twice", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 10n);
        await createProposal(contract, clients);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 1],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "vote",
                args: [0n, 2],
                account: clients[1].account,
            })
        );
    });

    it("voter cannot vote after deadline", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 10n);
        await createProposal(contract, clients, 60);

        await advanceTime(publicClient, 61);

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "vote",
                args: [0n, 1],
                account: clients[1].account,
            })
        );
    });

    // --- finalize ---

    it("proposal passes when yes weight exceeds no weight", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 10n);
        await registerVoter(contract, clients, 2, 3n);
        await createProposal(contract, clients, 60);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 1],
        });
        await clients[2].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 2],
        });

        await advanceTime(publicClient, 61);

        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "finalize", args: [0n],
        });

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals", args: [0n],
        });

        assert.equal(proposal[6], true, "Must be finalized");
        assert.equal(proposal[7], true, "Must have passed");
    });

    it("proposal fails when no weight exceeds yes weight", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 3n);
        await registerVoter(contract, clients, 2, 10n);
        await createProposal(contract, clients, 60);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 1],
        });
        await clients[2].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 2],
        });

        await advanceTime(publicClient, 61);

        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "finalize", args: [0n],
        });

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals", args: [0n],
        });

        assert.equal(proposal[7], false, "Must have failed");
    });

    it("cannot finalize before deadline", async () => {
        const { contract, clients, publicClient } = await deploy();

        await createProposal(contract, clients, 300);

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "finalize",
                args: [0n],
                account: clients[0].account,
            })
        );
    });

    it("cannot finalize twice", async () => {
        const { contract, clients, publicClient } = await deploy();

        await createProposal(contract, clients, 60);
        await advanceTime(publicClient, 61);

        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "finalize", args: [0n],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: contract.address, abi: contract.abi,
                functionName: "finalize",
                args: [0n],
                account: clients[0].account,
            })
        );
    });

    it("tie counts as failed", async () => {
        const { contract, clients, publicClient } = await deploy();

        await registerVoter(contract, clients, 1, 5n);
        await registerVoter(contract, clients, 2, 5n);
        await createProposal(contract, clients, 60);

        await clients[1].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 1],
        });
        await clients[2].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "vote", args: [0n, 2],
        });

        await advanceTime(publicClient, 61);

        await clients[0].writeContract({
            address: contract.address, abi: contract.abi,
            functionName: "finalize", args: [0n],
        });

        const proposal = await publicClient.readContract({
            address: contract.address, abi: contract.abi,
            functionName: "proposals", args: [0n],
        });

        assert.equal(proposal[7], false, "Tie must count as failed");
    });
});
