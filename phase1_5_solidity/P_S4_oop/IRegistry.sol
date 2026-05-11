// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error AlreadyRegistered(string name);
error InvalidName();
error InvalidAddress(address user);
error NotRegistered();
error Unauthorized();

interface IRegistry {
    function register(string calldata name) external;
    function isRegistered(address user) external view returns(bool);
    function getName(address user) external view returns(string memory name);
}

contract BasicRegistry is IRegistry {
    mapping(address => string) private _names;

    function register(string calldata name) external override {
        if(_names[msg.sender] != "") revert AlreadyRegistered(_names[msg.sender]);
        if(name == "") revert InvalidName();

        _names[msg.sender] = name;
    }

    function isRegistered(address user) external view override returns(bool) {
        if(user == address(0)) revert InvalidAddress(user);

        if(_names[user] == "") return false;
        return true;     
    }

    function getName(address user) external view override returns(string memory) {
        if(user == address(0)) revert InvalidAddress(user);
        if(_names[user] == "") revert NotRegistered();

        return _names[user];
    }
}

contract AdminRegistry is IRegistry {
    address public immutable admin;
    mapping(address => string) private _names;

    constructor() {
        admin = msg.sender;
    }

    function register(string calldata name) external override {
        if(msg.sender != admin ) revert Unauthorized();
        if(_names[msg.sender] != "") revert AlreadyRegistered(_names[msg.sender]);
        if(name == "") revert InvalidName();

        _names[msg.sender] = name;
    }

    function adminRegister(address user, string calldata name) external {
        if(msg.sender != admin ) revert Unauthorized();
        if(_names[user] != "") revert AlreadyRegistered(_names[user]);
        if(name == "") revert InvalidName();

        _names[user] = name;
    }

    function isRegistered(address user) external view override returns(bool) {
        if(user == address(0)) revert InvalidAddress(user);

        if(_names[user] == "") return false;
        return true;     
    }

    function getName(address user) external view override returns(string memory) {
        if(user == address(0)) revert InvalidAddress(user);
        if(_names[user] == "") revert NotRegistered();

        return _names[user];
    }
}