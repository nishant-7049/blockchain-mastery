// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Paused();
error BlacklistedUser(address caller);
error ZeroAmount();
error InsufficientBalance(uint256 currentBalance);
error TransferFailed();

contract Vault {
    mapping(address => uint256) public balances;
    mapping(address => bool) public blacklisted;
    bool public paused;

    function withdraw(uint256 amount) external {
        if(amount == 0) revert ZeroAmount();
        if(paused) revert Paused();
        if(blacklisted[msg.sender]) revert BlacklistedUser(msg.sender);
        uint256 balance = balances[msg.sender];
        if(amount > balance) revert InsufficientBalance(balance);

        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        if(!ok) revert TransferFailed();
    }
}