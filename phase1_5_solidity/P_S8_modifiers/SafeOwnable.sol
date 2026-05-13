// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error Unauthorized();
error ZeroAddress();
error RequestAlreadySent(address pendingOwner);
error NotPendingOwner(address caller);

contract SafeOwnable {
    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address owner, address newOwner);
    event OwnershipTransferred(address oldOwner, address newOwner);

    constructor() {
        owner = msg.sender;
        pendingOwner = address(0);
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier notZeroAddress(address user) {
        if(user == address(0)) revert ZeroAddress();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner notZeroAddress(newOwner) {
        if(pendingOwner == newOwner) revert RequestAlreadySent(pendingOwner);

        pendingOwner = newOwner;

        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if(pendingOwner != msg.sender) revert NotPendingOwner(msg.sender);

        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }

    function renounceOwnership() external onlyOwner {
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }
}