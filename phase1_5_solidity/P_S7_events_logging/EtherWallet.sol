// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized(address caller);
error InvalidAmount(uint256 amount);
error InsufficientBalance(uint256 available);
error TransferFailed();

contract EtherWallet {
    // events here
    event Deposited(address indexed depositer, uint256 amount);    
    event Withdrawn(address indexed withdrawer, uint256 amount);
    event FullDrain(address indexed owner, uint256 amount);

    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function deposit() external payable { 
        if(msg.value == 0) revert InvalidAmount(msg.value);

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external { 
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        if(amount > address(this).balance) revert InsufficientBalance(address(this).balance);
        if(amount == 0) revert InvalidAmount(amount);

        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if(!ok) revert TransferFailed();
    }

    function withdrawAll() external {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        uint256 amount = address(this).balance;
        if(0 == amount) revert InsufficientBalance(amount);
        

        emit FullDrain(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if(!ok) revert TransferFailed();
     }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}