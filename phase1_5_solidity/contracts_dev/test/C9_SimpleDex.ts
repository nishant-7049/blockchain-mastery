import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("SimpleDex tests", async () => {
    const { viem } = await network.create();

    const FEE_BPS = 30n; // 0.3%

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();

        // deploy two ERC20 tokens
        const tokenA = await viem.deployContract("ERC20", ["TokenA", "TKA"]);
        const tokenB = await viem.deployContract("ERC20", ["TokenB", "TKB"]);

        // deploy DEX with tokenA, tokenB and 0.3% fee
        const dex = await viem.deployContract("SimpleDex", [tokenA.address, tokenB.address, FEE_BPS]);

        return { tokenA, tokenB, dex, clients, publicClient };
    }

    // mint tokens to a user and approve dex to spend them
    async function mintAndApprove(token: any, dex: any, clients: any[], userIndex: number, amount: bigint) {
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[userIndex].account.address, amount],
        });
        await clients[userIndex].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [dex.address, amount],
        });
    }

    // add initial liquidity (1000 tokenA + 1000 tokenB) from clients[1]
    async function addInitialLiquidity(tokenA: any, tokenB: any, dex: any, clients: any[]) {
        const amount = parseEther("1000");
        await mintAndApprove(tokenA, dex, clients, 1, amount);
        await mintAndApprove(tokenB, dex, clients, 1, amount);
        await clients[1].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "addLiquidity",
            args: [amount, amount],
        });
    }

    // --- constructor ---

    it("deploys with correct tokenA, tokenB, feeBps", async () => {
        const { tokenA, tokenB, dex, publicClient } = await deploy();

        const storedA = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "tokenA" });
        const storedB = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "tokenB" });
        const storedFee = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "feeBps" });

        assert.equal(storedA.toLowerCase(), tokenA.address.toLowerCase());
        assert.equal(storedB.toLowerCase(), tokenB.address.toLowerCase());
        assert.equal(storedFee, FEE_BPS);
    });

    it("reverts deployment with zero address token", async () => {
        const { tokenB } = await deploy();

        await assert.rejects(
            viem.deployContract("SimpleDex", ["0x0000000000000000000000000000000000000000", tokenB.address, FEE_BPS])
        );
    });

    it("reverts deployment with zero fee", async () => {
        const { tokenA, tokenB } = await deploy();
        await assert.rejects(
            viem.deployContract("SimpleDex", [tokenA.address, tokenB.address, 0n])
        );
    });

    it("reverts deployment with fee >= 10000", async () => {
        const { tokenA, tokenB } = await deploy();
        await assert.rejects(
            viem.deployContract("SimpleDex", [tokenA.address, tokenB.address, 10000n])
        );
    });

    // --- addLiquidity (first deposit) ---

    it("first deposit sets reserves correctly", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const resA = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveA" });
        const resB = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveB" });

        assert.equal(resA, parseEther("1000"), "reserveA must be 1000");
        assert.equal(resB, parseEther("1000"), "reserveB must be 1000");
    });

    it("first deposit mints LP tokens to provider (sqrt - MIN_LIQUIDITY)", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // sqrt(1000e18 * 1000e18) = 1000e18, minus MIN_LIQUIDITY (1000)
        const expected = parseEther("1000") - 1000n;
        assert.equal(lpBalance, expected, "LP balance must be sqrt(amountA * amountB) - MIN_LIQUIDITY");
    });

    it("MIN_LIQUIDITY locked to address(0) on first deposit", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lockedLp = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: ["0x0000000000000000000000000000000000000000"],
        });

        assert.equal(lockedLp, 1000n, "1000 LP tokens must be locked to address(0)");
    });

    it("totalSupply equals lpMinted + MIN_LIQUIDITY after first deposit", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const totalSupply = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "totalSupply" });
        assert.equal(totalSupply, parseEther("1000"), "totalSupply must equal sqrt(amountA * amountB)");
    });

    it("reverts first deposit with tiny amounts (below MIN_LIQUIDITY)", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();

        await mintAndApprove(tokenA, dex, clients, 1, 100n);
        await mintAndApprove(tokenB, dex, clients, 1, 100n);

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "addLiquidity",
                args: [100n, 100n],
                account: clients[1].account,
            })
        );
    });

    it("reverts addLiquidity with zero amounts", async () => {
        const { dex, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "addLiquidity",
                args: [0n, parseEther("1000")],
                account: clients[1].account,
            })
        );
    });

    // --- addLiquidity (subsequent deposit) ---

    it("subsequent deposit with correct ratio mints LP tokens", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const amount = parseEther("500");
        await mintAndApprove(tokenA, dex, clients, 2, amount);
        await mintAndApprove(tokenB, dex, clients, 2, amount);

        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "addLiquidity",
            args: [amount, amount],
        });

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[2].account.address],
        });

        assert(lpBalance > 0n, "LP tokens must be minted to subsequent provider");
    });

    it("subsequent deposit updates reserves correctly", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const amount = parseEther("500");
        await mintAndApprove(tokenA, dex, clients, 2, amount);
        await mintAndApprove(tokenB, dex, clients, 2, amount);

        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "addLiquidity",
            args: [amount, amount],
        });

        const resA = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveA" });
        const resB = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveB" });

        assert.equal(resA, parseEther("1500"), "reserveA must be 1500 after second deposit");
        assert.equal(resB, parseEther("1500"), "reserveB must be 1500 after second deposit");
    });

    it("subsequent deposit reverts when ratio does not match", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        // pool is 1:1 but we try to deposit 2:1
        await mintAndApprove(tokenA, dex, clients, 2, parseEther("200"));
        await mintAndApprove(tokenB, dex, clients, 2, parseEther("100"));

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "addLiquidity",
                args: [parseEther("200"), parseEther("100")],
                account: clients[2].account,
            })
        );
    });

    // --- removeLiquidity ---

    it("can remove liquidity and get tokens back", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        await clients[1].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "removeLiquidity",
            args: [lpBalance],
        });

        const tokenABalance = await publicClient.readContract({
            address: tokenA.address, abi: tokenA.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        assert(tokenABalance > 0n, "Provider must receive tokenA back");
    });

    it("removing liquidity decreases reserves", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // remove half
        await clients[1].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "removeLiquidity",
            args: [lpBalance / 2n],
        });

        const resA = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveA" });

        assert(resA < parseEther("1000"), "reserveA must decrease after removing liquidity");
    });

    it("LP balance goes to zero after full removal", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        await clients[1].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "removeLiquidity",
            args: [lpBalance],
        });

        const lpAfter = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        assert.equal(lpAfter, 0n, "LP balance must be 0 after full removal");
    });

    it("reverts removeLiquidity with more LP than owned", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "removeLiquidity",
                args: [parseEther("9999")],
                account: clients[1].account,
            })
        );
    });

    it("reverts removeLiquidity with zero amount", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "removeLiquidity",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    // --- swap ---

    it("can swap tokenA for tokenB", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const swapAmount = parseEther("100");
        await mintAndApprove(tokenA, dex, clients, 2, swapAmount);

        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "swap",
            args: [tokenA.address, swapAmount],
        });

        const tokenBBalance = await publicClient.readContract({
            address: tokenB.address, abi: tokenB.abi,
            functionName: "balanceOf",
            args: [clients[2].account.address],
        });

        assert(tokenBBalance > 0n, "Buyer must receive tokenB");
    });

    it("can swap tokenB for tokenA", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const swapAmount = parseEther("100");
        await mintAndApprove(tokenB, dex, clients, 2, swapAmount);

        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "swap",
            args: [tokenB.address, swapAmount],
        });

        const tokenABalance = await publicClient.readContract({
            address: tokenA.address, abi: tokenA.abi,
            functionName: "balanceOf",
            args: [clients[2].account.address],
        });

        assert(tokenABalance > 0n, "Buyer must receive tokenA");
    });

    it("swap updates reserves correctly", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const swapAmount = parseEther("100");
        await mintAndApprove(tokenA, dex, clients, 2, swapAmount);

        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "swap",
            args: [tokenA.address, swapAmount],
        });

        const resA = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveA" });
        const resB = await publicClient.readContract({ address: dex.address, abi: dex.abi, functionName: "reserveB" });

        assert.equal(resA, parseEther("1000") + swapAmount, "reserveA must increase by full amountIn");
        assert(resB < parseEther("1000"), "reserveB must decrease after swap");
    });

    it("swap output matches getAmountOut", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const swapAmount = parseEther("100");

        // get expected output before swap
        const expected = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "getAmountOut",
            args: [swapAmount, parseEther("1000"), parseEther("1000")],
        });

        await mintAndApprove(tokenA, dex, clients, 2, swapAmount);
        await clients[2].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "swap",
            args: [tokenA.address, swapAmount],
        });

        const tokenBBalance = await publicClient.readContract({
            address: tokenB.address, abi: tokenB.abi,
            functionName: "balanceOf",
            args: [clients[2].account.address],
        });

        assert.equal(tokenBBalance, expected, "Received amount must match getAmountOut");
    });

    it("larger swap gives worse price (slippage)", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        // small swap: 10 tokenA
        const smallOut = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "getAmountOut",
            args: [parseEther("10"), parseEther("1000"), parseEther("1000")],
        });

        // large swap: 500 tokenA
        const largeOut = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "getAmountOut",
            args: [parseEther("500"), parseEther("1000"), parseEther("1000")],
        });

        // large swap should give less than 50x the small swap output (worse rate)
        assert(largeOut < smallOut * 50n, "Larger swap must have worse price per token (slippage)");
    });

    it("swap reverts for invalid token", async () => {
        const { dex, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "swap",
                args: ["0x000000000000000000000000000000000000dEaD", parseEther("100")],
                account: clients[1].account,
            })
        );
    });

    it("swap reverts with zero amount", async () => {
        const { tokenA, dex, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: dex.address, abi: dex.abi,
                functionName: "swap",
                args: [tokenA.address, 0n],
                account: clients[1].account,
            })
        );
    });

    // --- LP fees accumulation ---

    it("LP earns fees after swaps", async () => {
        const { tokenA, tokenB, dex, clients, publicClient } = await deploy();
        await addInitialLiquidity(tokenA, tokenB, dex, clients);

        const lpBalance = await publicClient.readContract({
            address: dex.address, abi: dex.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // record tokenA balance before removal
        const tokenABefore = await publicClient.readContract({
            address: tokenA.address, abi: tokenA.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // do several swaps to accumulate fees
        for (let i = 2; i <= 4; i++) {
            const swapAmount = parseEther("100");
            await mintAndApprove(tokenA, dex, clients, i, swapAmount);
            await clients[i].writeContract({
                address: dex.address, abi: dex.abi,
                functionName: "swap",
                args: [tokenA.address, swapAmount],
            });
        }

        // remove all liquidity
        await clients[1].writeContract({
            address: dex.address, abi: dex.abi,
            functionName: "removeLiquidity",
            args: [lpBalance],
        });

        const tokenAAfter = await publicClient.readContract({
            address: tokenA.address, abi: tokenA.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        // LP should receive more tokenA than originally deposited (fees accumulated)
        assert(tokenAAfter > tokenABefore + parseEther("1000"), "LP must earn fees from swaps");
    });
});
