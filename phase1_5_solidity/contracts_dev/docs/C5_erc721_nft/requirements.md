# C5 — ERC-721 NFT

## Overview

Standard ERC-721 non-fungible token. Each token has a unique ID owned by exactly one address. Follows ERC-721 behavior exactly — approvals cleared on transfer, safeTransfer checks receiver.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `name` | `string public` | Collection name, set in constructor |
| `symbol` | `string public` | Collection ticker, set in constructor |
| `owner` | `address public immutable` | Contract owner, controls mint |
| `balanceOf` | `mapping(address => uint256)` | Number of tokens owned per address |
| `ownerOf` | `mapping(uint256 => address)` | Owner of each token ID |
| `getApproved` | `mapping(uint256 => address)` | Approved address for a specific token |
| `isApprovedForAll` | `mapping(address => mapping(address => bool))` | Operator approvals |
| `_tokenURIs` | `mapping(uint256 => string)` | URI per token, set at mint |

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `tokenURI(uint256 tokenId)` | view | Returns URI for token. Reverts if token doesn't exist. |
| `approve(address to, uint256 tokenId)` | token owner or operator | Approve `to` to transfer a specific token |
| `setApprovalForAll(address operator, bool approved)` | anyone | Approve/revoke operator for all caller's tokens |
| `transferFrom(address from, address to, uint256 tokenId)` | owner, approved, or operator | Transfer token. Clears token approval after transfer. |
| `mint(address to, uint256 tokenId, string memory uri)` | contract owner only | Mint new token to `to` with given URI |
| `burn(uint256 tokenId)` | token owner only | Destroy token, clear approvals |

## Key ERC-721 Behaviors

- `transferFrom` clears `getApproved[tokenId]` after transfer
- `approve` reverts if caller is not token owner or approved operator
- `mint` reverts if tokenId already exists
- `burn` reverts if tokenId doesn't exist
- `tokenURI` reverts if tokenId doesn't exist

## Events

| Event | When |
|-------|------|
| `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` | On transfer, mint (from = address(0)), burn (to = address(0)) |
| `Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)` | On approve |
| `ApprovalForAll(address indexed owner, address indexed operator, bool approved)` | On setApprovalForAll |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Caller not owner/approved/operator for that token, or non-owner calls mint |
| `ZeroAddress()` | to is address(0) |
| `TokenDoesNotExist()` | tokenId has no owner |
| `TokenAlreadyExists()` | tokenId already minted |
