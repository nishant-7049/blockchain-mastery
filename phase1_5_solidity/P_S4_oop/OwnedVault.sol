// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error ZeroAmount();
error ZeroBalance();
error InsufficientAmount(uint256 currentAmount);

abstract contract Ownable {
    address public immutable owner;

    error Unauthorized(address caller);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        _;
    }
}

contract OwnedVault is Ownable {
    uint256 public balance;

    function deposit() external payable {
        if(msg.value == 0) revert ZeroAmount();

        balance += msg.value;
    }

    function withdraw(uint256 amount) external onlyOwner {
        if(amount>balances[msg.sender]) revert InsufficientAmount(balances[msg.sender]);

        balances[msg.sender] -= amount;
        (bool ok, ) = payable(msg.sender).transfer(amount);
        if(!ok) revert("Transaction Failed");
    }

    function emergencyDrain() external onlyOwner{
        if(balances[msg.sender] == 0) revert ZeroBalance();

        balances[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).transfer(amount);
        if(!ok) revert("Transaction Failed");
    }


}