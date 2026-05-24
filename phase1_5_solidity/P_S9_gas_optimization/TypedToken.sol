// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized();
error ZeroAddress();
error ZeroAmount();
error InsufficientBalance(uint256 currentBalance);

contract TypedToken {
    type TokenAmount is uint256;
    type TokenPrice is uint256;

    event TokenMinted(address indexed user, uint256 amount);
    event Transferred(address indexed from, address indexed to, uint256 amount);

    mapping(address => TokenAmount) public balances;
    address public immutable owner;
    TokenPrice public price;

    constructor() {
        owner = msg.sender;
        price = TokenPrice.wrap(1000);
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }
    
    function mint(address to, TokenAmount amount) external onlyOwner {
        if(to == address(0)) revert ZeroAddress();
        if(TokenAmount.unwrap(amount) == 0) revert ZeroAmount();

        balances[to] = TokenAmount.wrap(TokenAmount.unwrap(amount)+TokenAmount.unwrap(balances[to]));
        emit TokenMinted(to, TokenAmount.unwrap(amount));        
    }

    function getCost(TokenAmount amount) external view returns(TokenAmount) {
        if(TokenAmount.unwrap(amount) == 0) revert ZeroAmount();
        return TokenAmount.wrap(TokenAmount.unwrap(amount) * TokenPrice.unwrap(price));
    }

    function transfer(address to, TokenAmount amount) external {
        if(to == address(0)) revert ZeroAddress();
        if(TokenAmount.unwrap(amount) == 0) revert ZeroAmount();
        if(TokenAmount.unwrap(amount) > TokenAmount.unwrap(balances[msg.sender])) revert InsufficientBalance(TokenAmount.unwrap(balances[msg.sender]));

        balances[msg.sender] = TokenAmount.wrap(TokenAmount.unwrap(balances[msg.sender]) - TokenAmount.unwrap(amount));
        balances[to] = TokenAmount.wrap(TokenAmount.unwrap(balances[to]) + TokenAmount.unwrap(amount));

        emit Transferred(msg.sender, to, TokenAmount.unwrap(amount));
    }

}