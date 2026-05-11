// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error ZeroDeposit();
error InvalidValue(uint256 value);
error InsufficientAmount(uint256 balance);
error Unauthorized(address caller, address owner);
error InCooldownPeriod(uint256 timeleft);

contract CooldownVault {
    address public immutable owner;
    uint256 public balance;
    uint256 public lastWithdrawalTime;
    uint256 public constant cooldown = 1 days;

    constructor() {
        balance = 0;
        owner = msg.sender;
        lastWithdrawalTime = block.timestamp;
    }

    function deposit() external payable {
        if(msg.value <= 0 ) revert ZeroDeposit();
        
        balance += msg.value;
    }

    function withdraw(uint256 amount) external {
        if(msg.sender != owner) revert Unauthorized(msg.sender, owner);
        if(amount <=0) revert InvalidValue(amount);
        if(balance < amount) revert InsufficientAmount(balance);
        if(block.timestamp < lastWithdrawalTime + cooldown) revert InCooldownPeriod(lastWithdrawalTime + cooldown - block.timestamp);

        balance -= amount;
        lastWithdrawalTime = block.timestamp;
        (bool ok,) = payable(owner).call{value: amount}("");
        if(!ok) revert("Transfer failed");
    }

    function timeUntilNextWithdrawal() external view returns(uint256) {
        if(block.timestamp > lastWithdrawalTime + cooldown) return 0;
        return lastWithdrawalTime + cooldown - block.timestamp;
    }

    function contractBalance() external view returns(uint256) {
        return address(this).balance;
    }
}