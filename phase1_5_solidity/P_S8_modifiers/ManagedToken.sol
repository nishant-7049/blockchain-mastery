// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized();
error OperationsPaused();
error InvalidRole();
error RoleAlreadyGiven();
error RoleNotGranted();
error AlreadyUnpaused();
error ZeroAddressProvided();
error ZeroAmountProvided();
error InsufficientBalance(uint256 currentBalance);

contract ManagedToken {

    event RoleGranted(address indexed account, bytes32 role);
    event RoleRevoked(address indexed account, bytes32 role);
    event Paused(address indexed pauser);
    event Unpaused(address indexed pauser);
    event Transfer(address indexed from, address indexed to, uint256 amount);

    address public immutable admin;

    bytes32 public constant MINTER_ROLE= keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE= keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE= keccak256("PAUSER_ROLE");

    mapping(bytes32 => mapping(address => bool)) public roles;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    bool public paused;

    modifier onlyAdmin() {
        if(msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlyRole(bytes32 required) {
        if(!roles[required][msg.sender]) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if(paused) revert OperationsPaused();
        _;
    }

    modifier canBeRoles(bytes32 role) {
        if(role != MINTER_ROLE && role != BURNER_ROLE && role != PAUSER_ROLE) revert InvalidRole();
        _;
    }

    constructor() {
        admin = msg.sender;
        roles[MINTER_ROLE][msg.sender] = true;
        roles[BURNER_ROLE][msg.sender] = true;
        roles[PAUSER_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyAdmin canBeRoles(role) {
        if(roles[role][account]) revert RoleAlreadyGiven();

        roles[role][account] = true;
        emit RoleGranted(account, role);
    }

    function revokeRole(bytes32 role, address account) external onlyAdmin canBeRoles(role) {
        if(!roles[role][account]) revert RoleNotGranted();

        roles[role][account] = false;
        emit RoleRevoked(account, role);
    }

    function pause() external onlyRole(PAUSER_ROLE) whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        if(!paused) revert AlreadyUnpaused();

        paused = false;
        emit Unpaused(msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if(to == address(0)) revert ZeroAddressProvided();
        if(amount == 0) revert ZeroAmountProvided();

        balances[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) whenNotPaused {
        if(from == address(0)) revert ZeroAddressProvided();
        if(amount == 0) revert ZeroAmountProvided();
        if(amount > balances[from]) revert InsufficientBalance(balances[from]);

        balances[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external whenNotPaused {
        if(to == address(0)) revert ZeroAddressProvided();
        if(amount > balances[msg.sender]) revert InsufficientBalance(balances[msg.sender]);

        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }

}