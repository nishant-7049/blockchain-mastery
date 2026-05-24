import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("ERC721 tests", async () => {
    const { viem } = await network.create();

    async function deploy() {
        const clients = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        const nft = await viem.deployContract("ERC721", ["MyNFT", "MNFT"]);
        return { nft, clients, publicClient };
    }

    async function mintToken(nft: any, clients: any[], publicClient: any, tokenId: bigint, to = clients[1]) {
        await clients[0].writeContract({
            address: nft.address, abi: nft.abi, functionName: "mint",
            args: [to.account.address, tokenId, "https://token.uri/" + tokenId],
        });
    }

    // --- constructor ---

    it("sets name and symbol correctly", async () => {
        const { nft, publicClient } = await deploy();

        const name = await publicClient.readContract({ address: nft.address, abi: nft.abi, functionName: "name" });
        const symbol = await publicClient.readContract({ address: nft.address, abi: nft.abi, functionName: "symbol" });

        assert.equal(name, "MyNFT");
        assert.equal(symbol, "MNFT");
    });

    // --- mint ---

    it("owner can mint a token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        const tokenOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "ownerOf", args: [1n],
        });
        const balance = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "balanceOf", args: [clients[1].account.address],
        });

        assert.equal(tokenOwner.toLowerCase(), clients[1].account.address.toLowerCase());
        assert.equal(balance, 1n);
    });

    it("non-owner cannot mint", async () => {
        const { nft, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "mint",
                args: [clients[1].account.address, 1n, "https://token.uri/1"],
                account: clients[1].account,
            })
        );
    });

    it("cannot mint duplicate tokenId", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "mint",
                args: [clients[1].account.address, 1n, "https://token.uri/1"],
                account: clients[0].account,
            })
        );
    });

    it("tokenURI returns correct uri", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        const uri = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "tokenURI", args: [1n],
        });

        assert.equal(uri, "https://token.uri/1");
    });

    it("tokenURI reverts for nonexistent token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "tokenURI",
                args: [999n],
                account: clients[0].account,
            })
        );
    });

    // --- transferFrom ---

    it("owner can transfer their token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "transferFrom",
            args: [clients[1].account.address, clients[2].account.address, 1n],
        });

        const newOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "ownerOf", args: [1n],
        });
        const senderBalance = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "balanceOf", args: [clients[1].account.address],
        });
        const receiverBalance = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "balanceOf", args: [clients[2].account.address],
        });

        assert.equal(newOwner.toLowerCase(), clients[2].account.address.toLowerCase());
        assert.equal(senderBalance, 0n);
        assert.equal(receiverBalance, 1n);
    });

    it("transfer clears token approval", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "approve",
            args: [clients[2].account.address, 1n],
        });

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "transferFrom",
            args: [clients[1].account.address, clients[3].account.address, 1n],
        });

        const approved = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "getApproved", args: [1n],
        });

        assert.equal(approved, "0x0000000000000000000000000000000000000000");
    });

    it("unapproved address cannot transfer", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "transferFrom",
                args: [clients[1].account.address, clients[2].account.address, 1n],
                account: clients[3].account,
            })
        );
    });

    // --- approve ---

    it("token owner can approve another address", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "approve",
            args: [clients[2].account.address, 1n],
        });

        const approved = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "getApproved", args: [1n],
        });

        assert.equal(approved.toLowerCase(), clients[2].account.address.toLowerCase());
    });

    it("approved address can transfer token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "approve",
            args: [clients[2].account.address, 1n],
        });

        await clients[2].writeContract({
            address: nft.address, abi: nft.abi, functionName: "transferFrom",
            args: [clients[1].account.address, clients[3].account.address, 1n],
        });

        const newOwner = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "ownerOf", args: [1n],
        });

        assert.equal(newOwner.toLowerCase(), clients[3].account.address.toLowerCase());
    });

    // --- setApprovalForAll ---

    it("operator can transfer any token after setApprovalForAll", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);
        await mintToken(nft, clients, publicClient, 2n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "setApprovalForAll",
            args: [clients[2].account.address, true],
        });

        await clients[2].writeContract({
            address: nft.address, abi: nft.abi, functionName: "transferFrom",
            args: [clients[1].account.address, clients[3].account.address, 1n],
        });
        await clients[2].writeContract({
            address: nft.address, abi: nft.abi, functionName: "transferFrom",
            args: [clients[1].account.address, clients[3].account.address, 2n],
        });

        const balance = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "balanceOf", args: [clients[1].account.address],
        });

        assert.equal(balance, 0n, "All tokens must have been transferred by operator");
    });

    it("revoking operator blocks further transfers", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "setApprovalForAll",
            args: [clients[2].account.address, true],
        });
        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "setApprovalForAll",
            args: [clients[2].account.address, false],
        });

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "transferFrom",
                args: [clients[1].account.address, clients[3].account.address, 1n],
                account: clients[2].account,
            })
        );
    });

    // --- burn ---

    it("token owner can burn their token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await clients[1].writeContract({
            address: nft.address, abi: nft.abi, functionName: "burn", args: [1n],
        });

        const balance = await publicClient.readContract({
            address: nft.address, abi: nft.abi, functionName: "balanceOf", args: [clients[1].account.address],
        });

        assert.equal(balance, 0n);

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "tokenURI",
                args: [1n], account: clients[0].account,
            })
        );
    });

    it("non-owner cannot burn token", async () => {
        const { nft, clients, publicClient } = await deploy();

        await mintToken(nft, clients, publicClient, 1n);

        await assert.rejects(
            publicClient.simulateContract({
                address: nft.address, abi: nft.abi, functionName: "burn",
                args: [1n], account: clients[2].account,
            })
        );
    });
});
