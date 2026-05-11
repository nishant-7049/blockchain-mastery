// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error InvalidAmount(uint256 amount);
error InvalidAddress(address spender);
error InsufficientAmount(uint256 allowedAmount, uint256 spendingAmount);
error InsufficientBalance(uint256 currentBalance, uint256 spendingBalance);

contract Allowance {
    mapping(address => mapping(address => uint256)) public allowances;
    mapping(address => uint256) public balances;

    function approve(address spender, uint256 amount) external {
        if(amount==0) revert InvalidAmount(amount);
        if(spender == address(0)) revert InvalidAddress(spender);

        allowances[msg.sender][spender] = amount;
    }

    function transferFrom(address owner, address to, uint256 amount) external {
        if(owner == address(0)) revert InvalidAddress(owner);
        if(to == address(0)) revert InvalidAddress(to);
        if(amount == 0) revert InvalidAmount(amount);
        if(allowances[owner][msg.sender] < amount) revert InsufficientAmount(allowances[owner][msg.sender], amount);
        if(balances[owner] < amount) revert InsufficientBalance(balances[owner], amount);

        allowances[owner][msg.sender] -= amount;
        balances[owner] -= amount;
        balances[to] += amount;
    }

    function allowanceOf(address owner, address spender) external view returns(uint256) {
        if(owner == address(0)) revert InvalidAddress(owner);
        if(spender == address(0)) revert InvalidAddress(spender);
        
        uint256 allowance = allowances[owner][spender];
        return allowance;
    }

    function deposit(uint256 amount) external {
        if(amount == 0) revert InvalidAmount(amount);

        balances[msg.sender] += amount;
    }

}
