import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("DutchAuction tests", async () => {
    const { viem } = await network.create();

    // 1 ETH start, 0.1 ETH floor, 0.001 ETH/s discount
    // price hits floor after (1 - 0.1) / 0.001 = 900 seconds
    const STARTING_PRICE = parseEther("1");
    const FLOOR_PRICE = parseEther("0.1");
    const DISCOUNT_RATE = parseEther("0.001");

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const nft = await viem.deployContract("ERC721", ["TestNFT", "TNFT"]);
        const auction = await viem.deployContract("DutchAuction");
        return { nft, auction, clients, publicClient };
    }

    // mint NFT to seller (clients[0] is ERC721 owner so it mints), then approve auction contract
    async function mintAndApprove(nft: any, auction: any, clients: any[], sellerIndex: number, tokenId: bigint) {
        await clients[0].writeContract({
            address: nft.address, abi: nft.abi,
            functionName: "mint",
            args: [clients[sellerIndex].account.address, tokenId, "ipfs://test"],
        });
        await clients[sellerIndex].writeContract({
            address: nft.address, abi: nft.abi,
            functionName: "approve",
            args: [auction.address, tokenId],
        });
    }

    // mint + approve + createAuction in one step
    async function createAuction(nft: any, auction: any, clients: any[], sellerIndex: number, tokenId: bigint) {
        await mintAndApprove(nft, auction, clients, sellerIndex, tokenId);
        await clients[sellerIndex].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "createAuction",
            args: [nft.address, tokenId, STARTING_PRICE, FLOOR_PRICE, DISCOUNT_RATE],
        });
    }

    async function advanceTime(publicClient: any, seconds: number) {
        await (publicClient as any).request({ method: "evm_increaseTime", params: [seconds] });
        await (publicClient as any).request({ method: "evm_mine", params: [] });
    }

    // Auction struct indices:
    // [0] sender, [1] nftContract, [2] tokenId, [3] startingPrice,
    // [4] floorPrice, [5] discountRate, [6] startTime, [7] active, [8] exists

    // --- createAuction ---

    it("can create a valid auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        const auctionData = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions",
            args: [0n],
        });

        assert.equal(auctionData[0].toLowerCase(), clients[1].account.address.toLowerCase(), "Seller must match");
        assert.equal(auctionData[3], STARTING_PRICE, "Starting price must match");
        assert.equal(auctionData[4], FLOOR_PRICE, "Floor price must match");
        assert.equal(auctionData[7], true, "Auction must be active");
        assert.equal(auctionData[8], true, "Auction must exist");
    });

    it("NFT is transferred to auction contract on create", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        const nftOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi,
            functionName: "ownerOf",
            args: [1n],
        });

        assert.equal(nftOwner.toLowerCase(), auction.address.toLowerCase(), "Auction contract must hold the NFT");
    });

    it("cannot create auction with floorPrice equal to startingPrice", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await mintAndApprove(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "createAuction",
                args: [nft.address, 1n, parseEther("1"), parseEther("1"), DISCOUNT_RATE],
                account: clients[1].account,
            })
        );
    });

    it("cannot create auction with floorPrice greater than startingPrice", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await mintAndApprove(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "createAuction",
                args: [nft.address, 1n, parseEther("0.5"), parseEther("1"), DISCOUNT_RATE],
                account: clients[1].account,
            })
        );
    });

    it("cannot create auction with zero discount rate", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await mintAndApprove(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "createAuction",
                args: [nft.address, 1n, STARTING_PRICE, FLOOR_PRICE, 0n],
                account: clients[1].account,
            })
        );
    });

    it("cannot create auction with zero starting price", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await mintAndApprove(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "createAuction",
                args: [nft.address, 1n, 0n, FLOOR_PRICE, DISCOUNT_RATE],
                account: clients[1].account,
            })
        );
    });

    // --- buy ---

    it("buyer wins NFT at starting price", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        const nftOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi,
            functionName: "ownerOf",
            args: [1n],
        });

        assert.equal(nftOwner.toLowerCase(), clients[2].account.address.toLowerCase(), "Buyer must own the NFT");
    });

    it("auction marked inactive after buy", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        const auctionData = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions",
            args: [0n],
        });

        assert.equal(auctionData[7], false, "Auction must be inactive after sale");
    });

    it("seller receives ETH on sale", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        const sellerBalanceBefore = await publicClient.getBalance({ address: clients[1].account.address });

        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        const sellerBalanceAfter = await publicClient.getBalance({ address: clients[1].account.address });

        assert(sellerBalanceAfter > sellerBalanceBefore, "Seller must receive ETH");
    });

    it("buyer gets refund for overpayment", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        const buyerBalanceBefore = await publicClient.getBalance({ address: clients[2].account.address });

        // overpay by 1 ETH — should get 1 ETH back (minus gas)
        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: parseEther("2"),
        });

        const buyerBalanceAfter = await publicClient.getBalance({ address: clients[2].account.address });

        // paid 1 ETH for NFT + gas, NOT 2 ETH — so spent should be just over 1 ETH
        assert(buyerBalanceBefore - buyerBalanceAfter < parseEther("1.01"), "Buyer must be refunded the excess ETH");
    });

    it("cannot buy with insufficient payment", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "buy",
                args: [0n],
                value: parseEther("0.001"),
                account: clients[2].account,
            })
        );
    });

    it("cannot buy with zero value", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "buy",
                args: [0n],
                value: 0n,
                account: clients[2].account,
            })
        );
    });

    it("cannot buy already sold auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "buy",
                args: [0n],
                value: STARTING_PRICE,
                account: clients[3].account,
            })
        );
    });

    // --- getPrice ---

    it("getPrice returns starting price right after creation", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        const price = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "getPrice",
            args: [0n],
        });

        assert.equal(price, STARTING_PRICE, "Price must equal starting price at creation");
    });

    it("getPrice decreases after time passes", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await advanceTime(publicClient, 100);

        const price = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "getPrice",
            args: [0n],
        });

        assert(price < STARTING_PRICE, "Price must decrease over time");
    });

    it("getPrice never goes below floor price", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        // advance well past the time floor is reached (900s to reach floor)
        await advanceTime(publicClient, 5000);

        const price = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "getPrice",
            args: [0n],
        });

        assert.equal(price, FLOOR_PRICE, "Price must not drop below floor price");
    });

    it("getPrice reverts for non-existent auction", async () => {
        const { auction, publicClient } = await deploy();

        await assert.rejects(
            publicClient.readContract({
                address: auction.address, abi: auction.abi,
                functionName: "getPrice",
                args: [99n],
            })
        );
    });

    // --- cancel ---

    it("seller can cancel auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[1].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "cancel",
            args: [0n],
        });

        const auctionData = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions",
            args: [0n],
        });

        assert.equal(auctionData[7], false, "Auction must be inactive after cancel");
    });

    it("NFT returned to seller on cancel", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[1].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "cancel",
            args: [0n],
        });

        const nftOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi,
            functionName: "ownerOf",
            args: [1n],
        });

        assert.equal(nftOwner.toLowerCase(), clients[1].account.address.toLowerCase(), "Seller must get NFT back");
    });

    it("non-seller cannot cancel auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "cancel",
                args: [0n],
                account: clients[2].account,
            })
        );
    });

    it("cannot cancel already cancelled auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[1].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "cancel",
            args: [0n],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "cancel",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    it("cannot cancel a sold auction", async () => {
        const { nft, auction, clients, publicClient } = await deploy();
        await createAuction(nft, auction, clients, 1, 1n);

        await clients[2].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: auction.address, abi: auction.abi,
                functionName: "cancel",
                args: [0n],
                account: clients[1].account,
            })
        );
    });

    // --- multiple concurrent auctions ---

    it("multiple auctions can run concurrently", async () => {
        const { nft, auction, clients, publicClient } = await deploy();

        await createAuction(nft, auction, clients, 1, 1n);
        await createAuction(nft, auction, clients, 2, 2n);

        const auction0 = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions", args: [0n],
        });
        const auction1 = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions", args: [1n],
        });

        assert.equal(auction0[7], true, "Auction 0 must be active");
        assert.equal(auction1[7], true, "Auction 1 must be active");
        assert.equal(auction0[2], 1n, "Auction 0 tokenId must be 1");
        assert.equal(auction1[2], 2n, "Auction 1 tokenId must be 2");
    });

    it("buying one auction does not affect another", async () => {
        const { nft, auction, clients, publicClient } = await deploy();

        await createAuction(nft, auction, clients, 1, 1n);
        await createAuction(nft, auction, clients, 2, 2n);

        await clients[3].writeContract({
            address: auction.address, abi: auction.abi,
            functionName: "buy",
            args: [0n],
            value: STARTING_PRICE,
        });

        const auction1 = await publicClient.readContract({
            address: auction.address, abi: auction.abi,
            functionName: "auctions", args: [1n],
        });

        assert.equal(auction1[7], true, "Auction 1 must still be active");
    });
});
