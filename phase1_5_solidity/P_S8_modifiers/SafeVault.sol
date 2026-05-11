// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error InvalidAmount(uint256 amount);
error ReentrantCall(address directCaller, address originCaller);
error NoBalance();
error TransferFailed();
error InvalidBalance(uint256 currentBalance);

contract SafeVault {

    event Deposited(address indexed user, uint256 amount);

    bool private locked;

    receive() external payable {
        if(msg.value == 0) revert InvalidAmount(msg.value);

        emit Deposited(msg.sender, msg.value);
    }
    
    modifier noReentrancy() {
        if(locked) revert ReentrantCall(msg.sender, tx.origin);

        locked = true;
        _;
        locked = false;
    }

    function withdraw(uint256 amount) external noReentrancy {
        if(amount > address(this).balance) revert InvalidBalance(address(this).balance);

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if(!ok) revert TransferFailed();
    }
}