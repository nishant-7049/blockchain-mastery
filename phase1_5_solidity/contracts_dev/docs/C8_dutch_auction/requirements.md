# C8 — Dutch Auction

## Overview

A Dutch Auction contract where sellers list ERC-721 NFTs with a starting price that decreases over time. The first buyer to send enough ETH wins the NFT. Multiple auctions can run concurrently. Sellers can cancel if no bid has been placed yet.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `nextAuctionId` | `uint256` | Auto-incrementing ID for each new auction |
| `auctions` | `mapping(uint256 => Auction)` | All auctions keyed by ID |

## Structs

```
struct Auction {
    address seller          // who created the auction
    address nftContract     // ERC-721 contract address
    uint256 tokenId         // NFT token ID
    uint256 startingPrice   // price (in wei) at auction start
    uint256 floorPrice      // minimum price — price never drops below this
    uint256 discountRate    // wei per second the price decreases
    uint256 startTime       // block.timestamp when auction was created
    bool active             // true until sold or cancelled
}
```

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createAuction(address nftContract, uint256 tokenId, uint256 startingPrice, uint256 floorPrice, uint256 discountRate)` | anyone | Transfer NFT to contract, create auction. Reverts if `floorPrice > startingPrice` or `discountRate == 0`. |
| `buy(uint256 auctionId)` | anyone (payable) | Pay current price to win NFT. Reverts if auction not active or `msg.value < currentPrice`. Refunds excess ETH. |
| `cancel(uint256 auctionId)` | seller only | Cancel auction and return NFT. Reverts if auction not active. |
| `getPrice(uint256 auctionId)` | view | Returns current price for an active auction. |

## Price Formula

```
elapsed = block.timestamp - auction.startTime
currentPrice = startingPrice - (discountRate * elapsed)
currentPrice = max(currentPrice, floorPrice)
```

Price decreases every second by `discountRate` wei, but never goes below `floorPrice`.

## Rules

- Anyone can create an auction for any NFT they own (must approve contract first)
- `startingPrice` must be greater than `floorPrice`
- `discountRate` must be greater than 0
- Only the first buyer at or above `currentPrice` wins
- Excess ETH sent above `currentPrice` is refunded to buyer
- Seller receives exactly `currentPrice` in ETH
- Only the seller can cancel their own auction
- Cannot buy or cancel an already-sold or already-cancelled auction
- NFT is held by the contract during the auction

## Events

| Event | When |
|-------|------|
| `AuctionCreated(uint256 indexed auctionId, address indexed seller, address nftContract, uint256 tokenId, uint256 startingPrice, uint256 floorPrice, uint256 discountRate)` | Auction created |
| `AuctionSold(uint256 indexed auctionId, address indexed buyer, uint256 price)` | NFT sold |
| `AuctionCancelled(uint256 indexed auctionId)` | Auction cancelled by seller |

## Errors

| Error | When |
|-------|------|
| `InvalidPrice()` | `floorPrice >= startingPrice` |
| `ZeroDiscountRate()` | `discountRate == 0` |
| `AuctionNotActive()` | Buy or cancel on a sold/cancelled auction |
| `InsufficientPayment(uint256 currentPrice)` | `msg.value < currentPrice` |
| `Unauthorized()` | Non-seller tries to cancel |
| `TransferFailed()` | ETH refund transfer to buyer fails |
