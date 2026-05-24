// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error Unauthorized();
error InvalidMode();
error ZeroAmount();
error InsufficientBalance(uint256 currentBalance);
error TransferFailed();
error LowWithdrawAmount(uint256 minWithdrawAmount);

contract SortedVault {

    event FeeStrategyUpdated();
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 withdrawnAmount, uint256 feeTaken);

    address public immutable owner;
    mapping(address => uint256) public balances;

    function(uint256) internal pure returns(uint256) feeStrategy;

    function flatFee(uint256) internal pure returns(uint256) {
        
        return 0.001 ether;
    }

    function percentFee(uint256 amount) internal pure returns(uint256) {
        return amount/100;
    }

    constructor() {
        owner = msg.sender;
        feeStrategy = flatFee;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    function setStrategy(uint8 mode) external onlyOwner {
        if(mode > 1) revert InvalidMode();
        if(mode == 0) {
            feeStrategy = flatFee;
        }else {

            feeStrategy = percentFee;
        }
        emit FeeStrategyUpdated();
    }

    function deposit() external payable {
        if(msg.value == 0) revert ZeroAmount();

        balances[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if(amount == 0) revert ZeroAmount();
        uint256 balance = balances[msg.sender];
        if(amount > balance) revert InsufficientBalance(balance);


        uint256 feeTaken = feeStrategy(amount);
        if(amount < feeTaken) revert LowWithdrawAmount(feeTaken);
        uint256 withdrawnAmount = amount - feeTaken;

        balances[msg.sender] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: withdrawnAmount}("");
        if(!ok) revert TransferFailed();

        (bool ok1, ) = payable(owner).call{value: feeTaken}("");
        if(!ok1) revert TransferFailed();

        emit Withdrawn(msg.sender, withdrawnAmount, feeTaken);
    }

}