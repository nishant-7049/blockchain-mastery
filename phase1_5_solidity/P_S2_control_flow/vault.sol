// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error ZeroOrNegativeAmount(uint256 amount);
error InsufficientBalance(uint256 userBalance, uint256 balanceRequested);
error Unauthorized(address sender);

contract Vault {
    address public owner;
    mapping(address => uint256) public balances;

    constructor() {
        owner = msg.sender;
    }

    function deposit() public payable {
        if(msg.value == 0 ){
            revert ZeroOrNegativeAmount(msg.value);
        }
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        if(amount==0) revert ZeroOrNegativeAmount(amount);
        if(balances[msg.sender]<amount) revert InsufficientBalance(balances[msg.sender], amount);
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function adminWithdraw(uint256 amount) public {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        payable(owner).transfer(amount);
    }
}
