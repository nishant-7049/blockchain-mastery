// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Unauthorized();
error ZeroAmount();
error InsufficientBalance(uint256 currentBalance);
error ZeroAddress();
error TransferFailed();
error SameFeeBps();
error WalletPaused();
error AlreadyUnpaused();

contract EtherWallet {

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event FeeTaken(address owner, address indexed user, uint256 amount);
    event FeeBpsUpdated(uint256 olderBps, uint256 newBps);
    event TransactionsPaused();
    event TransactionsUnPaused();
    

    address public immutable owner;
    uint256 public feeBps;
    mapping(address => uint256) public balances;
    bool public paused;

    constructor() {
        owner = msg.sender;
        feeBps = 100;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonZeroAddress(address user) {
        if(user == address(0)) revert ZeroAddress();
        _;
    }

    modifier whenNotPaused() {
        if(paused) revert WalletPaused();
        _;
    }

    function deposit() external payable whenNotPaused {
        if(msg.value == 0) revert ZeroAmount();

        balances[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external whenNotPaused {
        if(amount == 0) revert ZeroAmount();
        uint256 userAmount = balances[msg.sender];
        if(amount > userAmount) revert InsufficientBalance(userAmount);

        uint256 feeAmount = amount * feeBps/10000;
        balances[msg.sender] -= amount;

        (bool sentUser, ) = payable(msg.sender).call{value: amount - feeAmount}("");
        if(!sentUser) revert TransferFailed();

        (bool sentOwner, ) = payable(owner).call{value: feeAmount}("");
        if(!sentOwner) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
        emit FeeTaken(owner, msg.sender, feeAmount);
    }

    function balanceOf(address user) external view nonZeroAddress(user) returns(uint256) {
        return balances[user];
    }

    function setFee(uint256 bps) external onlyOwner {
        if(bps == feeBps) revert SameFeeBps();
        uint256 olderBps = feeBps;
        feeBps = bps;

        emit FeeBpsUpdated(olderBps, feeBps);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit TransactionsPaused();
    }

    function unPause() external onlyOwner {
        if(!paused) revert AlreadyUnpaused();
        paused = false;
        emit TransactionsUnPaused();
    }
}