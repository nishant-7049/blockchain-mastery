// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized(address caller);          // (a) error for unauthorized access
error InsufficientBid(uint256 min, uint256 sent); // (b) error for bid too low

contract Bidding {
    address public owner;
    uint256 public minBid;
    address public topBidder;
    uint256 public topBid;

    constructor(uint256 _minBid) {
        owner = msg.sender;    // (c)
        minBid = _minBid;
    }

    function bid() external payable {    // (d) must accept ETH
        if (msg.value <= topBid) {         // (e) condition: bid must be strictly higher
            revert InsufficientBid(minBid, msg.value);  // (f) use the correct custom error
        }
        topBidder = msg.sender;
        topBid = msg.value;
    }

    function reset() external {
        if (msg.sender!= owner) revert Unauthorized(msg.sender);  // (g) access check
        topBidder = address(0);
        topBid = 0;
    }
}