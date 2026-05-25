import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("LendingProtocol tests", async () => {
    const { viem } = await network.create();

    // 1 ETH = 2000 borrow tokens
    const ETH_PRICE = parseEther("2000");
    // 0.1% per second — debt grows 10% every 100 seconds (high for easy testing)
    const INTEREST_PER_SECOND = 1000000000000000n; // 1e15
    const COLLATERAL_RATIO = 150n;

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const token = await viem.deployContract("ERC20", ["BorrowToken", "BTK"]);
        const lending = await viem.deployContract("LendingProtocol", [token.address, ETH_PRICE, INTEREST_PER_SECOND]);
        return { token, lending, clients, publicClient };
    }

    // mint tokens to owner and deposit into reserve
    async function setupReserve(token: any, lending: any, clients: any[], amount: bigint) {
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[0].account.address, amount],
        });
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [lending.address, amount],
        });
        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositReserve",
            args: [amount],
        });
    }

    // mint tokens to a user and approve lending to spend them (for repay/liquidate)
    async function mintAndApprove(token: any, lending: any, clients: any[], userIndex: number, amount: bigint) {
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[userIndex].account.address, amount],
        });
        await clients[userIndex].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [lending.address, amount],
        });
    }

    async function advanceTime(publicClient: any, seconds: number) {
        await (publicClient as any).request({ method: "evm_increaseTime", params: [seconds] });
        await (publicClient as any).request({ method: "evm_mine", params: [] });
    }

    // deposit 1 ETH from clients[1], borrow 1000 tokens — healthy position (hf = 200)
    async function setupHealthyPosition(token: any, lending: any, clients: any[]) {
        await setupReserve(token, lending, clients, parseEther("5000"));
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "borrow",
            args: [parseEther("1000")],
        });
    }

    // --- constructor ---

    it("deploys with correct parameters", async () => {
        const { token, lending, publicClient } = await deploy();

        const storedToken = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "borrowToken" });
        const storedPrice = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "ethPrice" });
        const storedRate = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "interestPerSecond" });

        assert.equal(storedToken.toLowerCase(), token.address.toLowerCase());
        assert.equal(storedPrice, ETH_PRICE);
        assert.equal(storedRate, INTEREST_PER_SECOND);
    });

    it("reverts deployment with zero address borrow token", async () => {
        await assert.rejects(
            viem.deployContract("LendingProtocol", ["0x0000000000000000000000000000000000000000", ETH_PRICE, INTEREST_PER_SECOND])
        );
    });

    it("reverts deployment with zero eth price", async () => {
        const { token } = await deploy();
        await assert.rejects(
            viem.deployContract("LendingProtocol", [token.address, 0n, INTEREST_PER_SECOND])
        );
    });

    it("reverts deployment with zero interest rate", async () => {
        const { token } = await deploy();
        await assert.rejects(
            viem.deployContract("LendingProtocol", [token.address, ETH_PRICE, 0n])
        );
    });

    // --- depositCollateral ---

    it("can deposit ETH collateral", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });

        const position = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        assert.equal(position[0], parseEther("1"), "Collateral must be 1 ETH");
    });

    it("multiple deposits accumulate collateral", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("2"),
        });

        const position = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        assert.equal(position[0], parseEther("3"), "Collateral must accumulate to 3 ETH");
    });

    it("reverts depositCollateral with zero ETH", async () => {
        const { lending, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "depositCollateral",
                value: 0n,
                account: clients[1].account,
            })
        );
    });

    // --- withdrawCollateral ---

    it("can withdraw collateral when no debt", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("2"),
        });

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "withdrawCollateral",
            args: [parseEther("1")],
        });

        const position = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        assert.equal(position[0], parseEther("1"), "Remaining collateral must be 1 ETH");
    });

    it("cannot withdraw more than deposited", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "withdrawCollateral",
                args: [parseEther("2")],
                account: clients[1].account,
            })
        );
    });

    it("cannot withdraw collateral that would breach 150% ratio", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        // deposited 1 ETH (2000 tokens value), borrowed 1000 tokens
        // withdrawing 0.4 ETH → remaining = 0.6 ETH = 1200 token value
        // healthFactor = 1200 * 100 / 1000 = 120 < 150 → should revert
        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "withdrawCollateral",
                args: [parseEther("0.4")],
                account: clients[1].account,
            })
        );
    });

    it("user receives ETH on withdraw", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("2"),
        });

        const balanceBefore = await publicClient.getBalance({ address: clients[1].account.address });

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "withdrawCollateral",
            args: [parseEther("1")],
        });

        const balanceAfter = await publicClient.getBalance({ address: clients[1].account.address });

        assert(balanceAfter > balanceBefore, "User must receive ETH back");
    });

    // --- depositReserve ---

    it("owner can deposit reserve tokens", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("5000"));

        const reserve = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "reserveBalance" });

        assert.equal(reserve, parseEther("5000"), "Reserve must be 5000 tokens");
    });

    it("non-owner cannot deposit reserve", async () => {
        const { token, lending, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "depositReserve",
                args: [parseEther("100")],
                account: clients[1].account,
            })
        );
    });

    // --- borrow ---

    it("can borrow within collateral ratio", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("5000"));

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });

        // max borrow = 2000 * 100/150 = 1333 tokens, borrowing 1000 is safe
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "borrow",
            args: [parseEther("1000")],
        });

        const tokenBalance = await publicClient.readContract({
            address: token.address, abi: token.abi,
            functionName: "balanceOf",
            args: [clients[1].account.address],
        });

        assert.equal(tokenBalance, parseEther("1000"), "User must receive borrowed tokens");
    });

    it("cannot borrow above 150% ratio", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("5000"));

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });

        // max borrow = 1333 tokens, trying 1400 should fail
        // healthFactor = 2000 * 100 / 1400 = 142 < 150
        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "borrow",
                args: [parseEther("1400")],
                account: clients[1].account,
            })
        );
    });

    it("cannot borrow more than reserve", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("100"));

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("10"),
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "borrow",
                args: [parseEther("500")],
                account: clients[1].account,
            })
        );
    });

    it("borrow decreases reserve balance", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("5000"));

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "borrow",
            args: [parseEther("1000")],
        });

        const reserve = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "reserveBalance" });
        assert.equal(reserve, parseEther("4000"), "Reserve must decrease by borrowed amount");
    });

    it("cannot borrow zero", async () => {
        const { lending, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "borrow",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    // --- repay ---

    it("can repay full debt", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        // snapshot shares before repay
        const positionBefore = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        // mint 100 extra tokens to cover accrued interest
        await clients[0].writeContract({
            address: token.address, abi: token.abi,
            functionName: "mint",
            args: [clients[1].account.address, parseEther("100")],
        });
        // approve enough to cover full debt (1000 principal + 100 buffer) before simulating
        await clients[1].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [lending.address, parseEther("1100")],
        });

        // get current debt snapshot
        const { result: currentDebt } = await publicClient.simulateContract({
            address: lending.address, abi: lending.abi,
            functionName: "getDebt",
            account: clients[1].account,
        });

        // repay current debt — 1 more block will mine between simulate and repay
        // meaning ~1 more second of interest (~1 token) accrues — that dust stays
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "repay",
            args: [currentDebt],
        });

        const positionAfter = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        // 99%+ of shares must be gone — dust from 1 block of accrual stays, that is expected
        assert(positionAfter[1] < positionBefore[1] / 100n, "Almost all debt shares must be removed after repaying current debt");
    });

    it("repay increases reserve balance", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        const reserveBefore = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "reserveBalance" });

        await clients[1].writeContract({
            address: token.address, abi: token.abi,
            functionName: "approve",
            args: [lending.address, parseEther("500")],
        });
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "repay",
            args: [parseEther("500")],
        });

        const reserveAfter = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "reserveBalance" });

        assert(reserveAfter > reserveBefore, "Reserve must increase after repay");
    });

    it("cannot repay more than current debt", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        await mintAndApprove(token, lending, clients, 1, parseEther("2000"));

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "repay",
                args: [parseEther("2000")],
                account: clients[1].account,
            })
        );
    });

    // --- interest accrual ---

    it("debt grows over time", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        // record debt shares before
        const positionBefore = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        await advanceTime(publicClient, 100);

        // trigger accrual by reading debt
        const { result: debtAfter } = await publicClient.simulateContract({
            address: lending.address, abi: lending.abi,
            functionName: "getDebt",
            account: clients[1].account,
        });

        // after 100s at 0.1%/s: debt grows by 10% → 1000 * 1.1 = 1100 tokens
        assert(debtAfter > parseEther("1000"), "Debt must grow over time");
    });

    it("total debt increases after interest accrual", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        const totalDebtBefore = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "totalDebt" });

        await advanceTime(publicClient, 100);

        // trigger accrual — withdrawCollateral calls accrueInterest() internally
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "withdrawCollateral",
            args: [1n], // withdraw 1 wei to trigger accrual without meaningfully changing position
        });

        const totalDebtAfter = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "totalDebt" });

        assert(totalDebtAfter > totalDebtBefore, "Total debt must grow after interest accrual");
    });

    // --- setEthPrice ---

    it("owner can update ETH price", async () => {
        const { lending, clients, publicClient } = await deploy();

        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1500")],
        });

        const price = await publicClient.readContract({ address: lending.address, abi: lending.abi, functionName: "ethPrice" });
        assert.equal(price, parseEther("1500"));
    });

    it("non-owner cannot update ETH price", async () => {
        const { lending, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "setEthPrice",
                args: [parseEther("1500")],
                account: clients[1].account,
            })
        );
    });

    it("reverts setEthPrice with same price", async () => {
        const { lending, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "setEthPrice",
                args: [ETH_PRICE],
                account: clients[0].account,
            })
        );
    });

    // --- liquidate ---

    it("cannot liquidate a healthy position", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        await mintAndApprove(token, lending, clients, 2, parseEther("500"));

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "liquidate",
                args: [clients[1].account.address, parseEther("500")],
                account: clients[2].account,
            })
        );
    });

    it("can liquidate unhealthy position", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        // drop ETH price to 1400 → healthFactor = 1400*100/1000 = 140 < 150
        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1400")],
        });

        await mintAndApprove(token, lending, clients, 2, parseEther("500"));

        // snapshot shares before liquidation
        const positionBefore = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        await clients[2].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "liquidate",
            args: [clients[1].account.address, parseEther("500")],
        });

        const positionAfter = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        assert(positionAfter[1] < positionBefore[1], "User debt shares must decrease after liquidation");
    });

    it("liquidator receives ETH collateral", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1400")],
        });

        await mintAndApprove(token, lending, clients, 2, parseEther("500"));

        const balanceBefore = await publicClient.getBalance({ address: clients[2].account.address });

        await clients[2].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "liquidate",
            args: [clients[1].account.address, parseEther("500")],
        });

        const balanceAfter = await publicClient.getBalance({ address: clients[2].account.address });

        assert(balanceAfter > balanceBefore, "Liquidator must receive ETH");
    });

    it("user collateral decreases after liquidation", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1400")],
        });

        await mintAndApprove(token, lending, clients, 2, parseEther("500"));

        const positionBefore = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        await clients[2].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "liquidate",
            args: [clients[1].account.address, parseEther("500")],
        });

        const positionAfter = await publicClient.readContract({
            address: lending.address, abi: lending.abi,
            functionName: "positions",
            args: [clients[1].account.address],
        });

        assert(positionAfter[0] < positionBefore[0], "User collateral must decrease after liquidation");
    });

    it("cannot liquidate more than user debt", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1400")],
        });

        await mintAndApprove(token, lending, clients, 2, parseEther("5000"));

        await assert.rejects(
            publicClient.simulateContract({
                address: lending.address, abi: lending.abi,
                functionName: "liquidate",
                args: [clients[1].account.address, parseEther("5000")],
                account: clients[2].account,
            })
        );
    });

    it("position becomes liquidatable after price drop", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupHealthyPosition(token, lending, clients);

        // verify healthy before price drop
        const { result: hfBefore } = await publicClient.simulateContract({
            address: lending.address, abi: lending.abi,
            functionName: "getHealthFactor",
            args: [clients[1].account.address],
            account: clients[0].account,
        });
        assert(hfBefore >= COLLATERAL_RATIO, "Position must be healthy before price drop");

        // drop price
        await clients[0].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "setEthPrice",
            args: [parseEther("1400")],
        });

        const { result: hfAfter } = await publicClient.simulateContract({
            address: lending.address, abi: lending.abi,
            functionName: "getHealthFactor",
            args: [clients[1].account.address],
            account: clients[0].account,
        });
        assert(hfAfter < COLLATERAL_RATIO, "Position must be unhealthy after price drop");
    });

    it("position becomes liquidatable after interest accrual", async () => {
        const { token, lending, clients, publicClient } = await deploy();
        await setupReserve(token, lending, clients, parseEther("5000"));

        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "depositCollateral",
            value: parseEther("1"),
        });

        // borrow close to max: 1300 tokens (hf = 2000*100/1300 = 153, just above 150)
        await clients[1].writeContract({
            address: lending.address, abi: lending.abi,
            functionName: "borrow",
            args: [parseEther("1300")],
        });

        // advance time — interest will push debt above safe threshold
        await advanceTime(publicClient, 200);

        // trigger accrual and check health
        const { result: hfAfter } = await publicClient.simulateContract({
            address: lending.address, abi: lending.abi,
            functionName: "getHealthFactor",
            args: [clients[1].account.address],
            account: clients[0].account,
        });

        assert(hfAfter < COLLATERAL_RATIO, "Position must become unhealthy as interest accrues");
    });
});
