// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleStorage {
    uint256 public value;
    address immutable owner;

    constructor() {
        owner = msg.sender;
    }

    function setValue(uint256 _value) public {
        require(msg.sender == owner, "signer must be owner");
        value = _value;
    }

    function getValue() public view returns (uint256){
        return value;
    }

    function whoDeployed() public view returns (address){
        return owner;
    }

}