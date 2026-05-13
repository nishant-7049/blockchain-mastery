// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized();
error PausedCurrently();
error UnpausedCurrently();

contract AdminPanel {

    address public immutable owner;
    bool public paused;

    event Paused();
    event Unpaused();
    event WorkDone();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if(paused) revert PausedCurrently();
        _;
    }

    modifier whenPaused() {
        if(!paused) revert UnpausedCurrently();
        _;
    }

    function pause() external onlyOwner whenNotPaused {

        paused = true;

        emit Paused();
    }

    function unpause() external onlyOwner whenPaused {

        paused = false;

        emit Unpaused();
    } 

    function doWork() external onlyOwner whenNotPaused {

        emit WorkDone();
    }
}