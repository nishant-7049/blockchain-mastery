// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Unauthorized();

contract Counter {
    uint256 public count;
    address public immutable owner;

    event Incremented(address indexed user, uint256 currentCount);
    event Reset();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if(owner != msg.sender) revert Unauthorized();
        _;
    }

    function increment() external {
        ++count;
        emit Incremented(msg.sender, count);
    }

    function reset() external onlyOwner {
        count = 0;
        emit Reset();
    }
}