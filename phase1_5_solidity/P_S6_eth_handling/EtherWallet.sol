// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized(address caller);
error InvalidAmount(uint256 amount);
error InsufficientBalance(uint256 currentBalance);

contract EtherWallet {
    address public immutable owner;
    uint256 public balance;

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        balance += msg.value;
    }

    fallback() external payable {
        balance += msg.value;
    }

    function deposit() external payable {
        if(msg.value == 0) revert InvalidAmount(msg.value);

        balance += msg.value;
    }

    function withdraw(uint256 amount) external {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        if(amount == 0) revert InvalidAmount(amount);
        if(amount > address(this).balance) revert InsufficientBalance(address(this).balance);

        balance -= amount;
        (bool ok, ) = payable(owner).call{value: amount}("");
        if(!ok) revert("Transfer Failed");
    }

    function withdrawAll() external {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        if(0 == address(this).balance) revert InsufficientBalance(address(this).balance);

        uint256 amount = address(this).balance;
        balance = 0;
        (bool ok, ) = payable(owner).call{value: amount}("");
        if(!ok) revert("Transfer Failed");
    }

    function getBalance() external view returns(uint256) {
        return address(this).balance;
    }    
}