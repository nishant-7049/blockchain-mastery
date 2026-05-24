import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("StakingContract tests", async () => {
    const { viem } = await network.create();

    const ONE_YEAR = 31536000n;
    const ONE_MINUTE = 60n;

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();

        // deploy ERC20 token to use as staking token
        const token = await viem.deployContract("ERC20", ["StakeToken", "STK"]);

        // deploy staking contract
        const staking = await viem.deployContract("StakingContract", [token.address]);

        // set minLockDuration to 60s for easier testing
        await clients[0].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "setMinStakeDuration",
            args: [ONE_MINUTE],
        });

        return { token, staking, clients, publicClient };
    }

    async function advanceTime(publicClient: any, seconds: bigint) {
        await (publicClient as any).request({ method: "evm_increaseTime", params: [Number(seconds)] });
        await (publicClient as any).request({ method: "evm_mine", params: [] });
    }

    async function mintAndApprove(token: any, staking: any, clients: any[], userIndex: number, amount: bigint) {
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[userIndex].account.address, amount],
        });
        await clients[userIndex].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [staking.address, amount],
        });
    }

    // --- stake ---

    it("user can stake tokens", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake",
            args: [parseEther("1000")],
        });

        const userStake = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "stakes",
            args: [clients[1].account.address],
        });

        assert.equal(userStake[0], parseEther("1000"), "Staked amount must match");
    });

    it("cannot stake zero amount", async () => {
        const { staking, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "stake",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    it("cannot stake below minimum", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, 50n);

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "stake",
                args: [50n],
                account: clients[1].account,
            })
        );
    });

    it("cannot stake twice while already staking", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("2000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "stake",
                args: [parseEther("1000")],
                account: clients[1].account,
            })
        );
    });

    // --- unstake early (no reward) ---

    it("early unstake returns principal only", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        // unstake before minLockDuration
        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "unstake",
        });

        const balance = await publicClient.readContract({
            address: token.address, abi: token.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        assert.equal(balance, parseEther("1000"), "Must get back principal only");
    });

    it("early unstake emits reward as 0", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "unstake",
        });

        const events = await publicClient.getContractEvents({
            address: staking.address, abi: staking.abi,
            eventName: "Unstaked",
        });

        assert.equal(events[0].args.reward, 0n, "Reward must be 0 for early unstake");
    });

    // --- unstake after lock duration (with reward) ---

    it("unstake after lock duration returns principal plus reward", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        // deposit rewards first
        await mintAndApprove(token, staking, clients, 0, parseEther("500"));
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [staking.address, parseEther("500")],
        });
        await clients[0].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "depositRewards", args: [parseEther("500")],
        });

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        // advance 1 year
        await advanceTime(publicClient, ONE_YEAR);

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "unstake",
        });

        const balance = await publicClient.readContract({
            address: token.address, abi: token.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // 1000 tokens at 10% APY for 1 year = 100 tokens reward
        assert(balance > parseEther("1000"), "Must receive more than principal after full lock");
    });

    it("stake is cleared after unstake", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "unstake",
        });

        const userStake = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "stakes",
            args: [clients[1].account.address],
        });

        assert.equal(userStake[0], 0n, "Stake amount must be 0 after unstake");
        assert.equal(userStake[1], 0n, "Start time must be 0 after unstake");
    });

    it("cannot unstake when not staking", async () => {
        const { staking, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "unstake",
                account: clients[1].account,
            })
        );
    });

    // --- depositRewards ---

    it("owner can deposit rewards", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[0].account.address, parseEther("500")],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [staking.address, parseEther("500")],
        });

        await clients[0].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "depositRewards", args: [parseEther("500")],
        });

        const pool = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "rewardPool",
        });

        assert.equal(pool, parseEther("500"));
    });

    it("non-owner cannot deposit rewards", async () => {
        const { staking, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "depositRewards",
                args: [parseEther("100")],
                account: clients[1].account,
            })
        );
    });

    // --- pendingReward ---

    it("pendingReward returns 0 before min lock duration", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        const reward = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "pendingReward",
            args: [clients[1].account.address],
        });

        assert.equal(reward, 0n);
    });

    it("pendingReward returns non-zero after lock duration", async () => {
        const { token, staking, clients, publicClient } = await deploy();

        await mintAndApprove(token, staking, clients, 1, parseEther("1000"));

        await clients[1].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "stake", args: [parseEther("1000")],
        });

        await advanceTime(publicClient, ONE_YEAR);

        const reward = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "pendingReward",
            args: [clients[1].account.address],
        });

        assert(reward > 0n, "Pending reward must be positive after lock duration");
    });

    // --- admin functions ---

    it("owner can update APY", async () => {
        const { staking, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: staking.address, abi: staking.abi,
            functionName: "setApy", args: [500n],
        });

        const apy = await publicClient.readContract({
            address: staking.address, abi: staking.abi,
            functionName: "apyBps",
        });

        assert.equal(apy, 500n);
    });

    it("non-owner cannot update APY", async () => {
        const { staking, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: staking.address, abi: staking.abi,
                functionName: "setApy",
                args: [500n],
                account: clients[1].account,
            })
        );
    });
});
