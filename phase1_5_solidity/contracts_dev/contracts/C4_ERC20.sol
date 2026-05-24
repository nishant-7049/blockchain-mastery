// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error ZeroAddress();
error ZeroAmount();
error InsufficientAllowance(uint256 currentAllowance);
error Unauthorized();
error InsufficientBalance(uint256 currentBalance);

contract ERC20 {

    event Transferred(address indexed from, address indexed to, uint256 amount);
    event AllowedBalance(address indexed owner, address indexed spender, uint256 amount);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    string public name;
    string public symbol;
    uint256 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable owner;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    modifier notZeroAddress(address user) {
        if(address(0) == user) revert ZeroAddress();
        _;
    }

    modifier notZeroAmount(uint256 amount) {
        if(amount == 0) revert ZeroAmount();
        _;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    function transfer(address to, uint256 amount) external notZeroAddress(to) notZeroAmount(amount) returns (bool) {
        uint256 userBalance = balanceOf[msg.sender];
        if(amount > userBalance) revert InsufficientBalance(userBalance);

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transferred(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external notZeroAddress(from) notZeroAddress(to) notZeroAmount(amount) returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if(currentAllowance < amount) revert InsufficientAllowance(currentAllowance);
        uint256 currentBalance = balanceOf[from];
        if(amount > currentBalance) revert InsufficientBalance(currentBalance);

        if(currentAllowance != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transferred(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external notZeroAddress(spender) notZeroAmount(amount) {
        allowance[msg.sender][spender] = amount;

        emit AllowedBalance(msg.sender, spender, amount);
    }

    function mint(address to, uint256 amount) external notZeroAddress(to) notZeroAmount(amount) onlyOwner {
        balanceOf[to] += amount;
        totalSupply += amount;

        emit Minted(to, amount);
    }

    function burn(uint256 amount) external notZeroAmount(amount) {
        uint256 currentBalance = balanceOf[msg.sender];
        if(amount > currentBalance) revert InsufficientBalance(currentBalance);

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        emit Burned(msg.sender, amount);
    }
}