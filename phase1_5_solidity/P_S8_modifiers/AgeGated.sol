// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error InvalidAddress(address user);
error InvalidAge(uint256 age);
error RequiredAge(uint256 age);

contract AgeGated {

    enum Purchasable {
        ALCOHOL,
        CAR
    }

    event AgeInitialized(address indexed user, uint256 age);
    event Purchased(address indexed user,Purchasable item );

    uint256 public constant MIN_ALCOHOL_AGE = 18;
    uint256 public constant MIN_CAR_RENT_AGE = 21;

    mapping(address => uint256) public ages;

    modifier validAddress(address user) {
        if(user == address(0)) revert InvalidAddress(user);
        _;
    }

    modifier validAge(uint256 age) {
        if(age == 0 || age > 150) revert InvalidAge(age);
        _;
    }

    function setAge(address user, uint256 age) external validAddress(user) validAge(age) {

        ages[user] = age;
        emit AgeInitialized(user, age);
    }

    modifier minAge(uint256 required) {
        if(required > ages[msg.sender]) revert RequiredAge(required);
        _;
    }

    function buyAlcohol() external minAge(MIN_ALCOHOL_AGE) {
        emit Purchased(msg.sender, Purchasable.ALCOHOL);
    }

    function rentCar() external minAge(MIN_CAR_RENT_AGE) {
        emit Purchased(msg.sender, Purchasable.CAR);
    }
}