// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error ZeroNumber();
error Unauthorized(address caller);

contract AccessVault{
    address public immutable owner;
    uint256 public secretNumber;

    constructor(uint256 _num) {
        if(_num==0) revert ZeroNumber();
        owner = msg.sender;
        secretNumber = _num;
    }

    function setNumber(uint256 _num) external {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        if(_num==0) revert ZeroNumber();

        secretNumber = _num;
    }

    function doubleIt() external {
        if(msg.sender != owner) revert Unauthorized(msg.sender);
        uint256 prevNumber = secretNumber;
        secretNumber = secretNumber * 2;
        assert(secretNumber/2 == prevNumber);
    }

    function getNumber() external view returns(uint256) {
        return secretNumber;
    }
}