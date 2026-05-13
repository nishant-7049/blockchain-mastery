// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized();
error AlreadyGrantedRole(bytes32 role);
error InvalidRoleProvided(bytes32 role);
error ZeroAddressProvided(address account);
error AccountDontHaveRole(bytes32 role);
error ZeroAmount();
error InsufficientBalance(uint256 currentBalance);
error TransferFailed();

contract RBACVault {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    mapping(bytes32 => mapping(address => bool)) public roles;

    event RoleGranted(bytes32 role, address indexed account);
    event RoleRevoked(bytes32 role, address indexed account);
    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed sender, uint256 amount);

    constructor() {
        roles[ADMIN_ROLE][msg.sender] = true;
        roles[DEPOSITOR_ROLE][msg.sender] = true;
        roles[WITHDRAWER_ROLE][msg.sender] = true;
    }

    modifier onlyRole(bytes32 required) {
        if(!roles[required][msg.sender]) revert Unauthorized();
        _;
    }

    modifier rolesCanBe(bytes32 role) {
        if(role != ADMIN_ROLE && role != DEPOSITOR_ROLE && role != WITHDRAWER_ROLE) revert InvalidRoleProvided(role);
        _;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) rolesCanBe(role) {
        if(account == address(0)) revert ZeroAddressProvided(address(0));
        if(roles[role][account]) revert AlreadyGrantedRole(role);

        roles[role][account] = true;

        emit RoleGranted(role, account);
    }


    function revokeRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) rolesCanBe(role) {
        if(account == address(0)) revert ZeroAddressProvided(address(0));
        if(!roles[role][account]) revert AccountDontHaveRole(role);

        roles[role][account] = false;

        emit RoleRevoked(role, account);
    }

    function deposit() external onlyRole(DEPOSITOR_ROLE) payable {
        if(msg.value == 0) revert ZeroAmount(); 

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        if(amount == 0) revert ZeroAmount();
        uint256 totalBalance = address(this).balance;
        if(amount > totalBalance) revert InsufficientBalance(totalBalance);

        emit Withdrawn(msg.sender, amount);
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if(!ok) revert TransferFailed();
    }
}