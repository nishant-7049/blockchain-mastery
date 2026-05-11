// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {
    uint256 public count; 
    address public immutable owner;
    
    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner () {
        if(owner != msg.sender) revert("Not Owner");
        _;
    }

    function increment() external onlyOwner {

        count++;
    }

    function reset() external onlyOwner {
        count = 0;
    }
}