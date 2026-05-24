// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Unauthorized();
error ZeroAddress();
error ZeroAmount();
error ZeroData();
error TransactionExpired(uint256 expiredAt);
error TransactionFailed();
error AlreadyConfirmed();
error NotConfirmed();
error AlreadyExecuted();
error AlreadyOwner();
error NotOwner();
error MinimumOwnerLimit();

contract MultiSigWallet {

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmationCount;
        uint256 expiresAt;
    }

    event TransactionConfirmed(Transaction txn);
    event ProposerGiven(Transaction txn);
    event ConfirmedTxn(address indexed owner, Transaction txn);
    event RevokedConfirmation(address indexed owner, Transaction txn);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event Deposited(address indexed user, uint256 amount);

    address[] public owners;
    mapping(address => bool) public isOwner;
    mapping(address => uint256) public ownerIndex;
    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;
    uint256 public expiryDuration;

    constructor(address[] memory _owners) {
        owners = _owners;
        for(uint256 i = 0; i<owners.length; ++i) {
            isOwner[owners[i]] = true;
            ownerIndex[owners[i]] = i;
        }
        expiryDuration = 120;
    }


    modifier onlyOwner() {
        if(!isOwner[msg.sender]) revert Unauthorized();
        _;
    }

    modifier nonZeroAddress(address user) {
        if(user == address(0)) revert ZeroAddress();
        _;
    }

    modifier nonZeroBytes(bytes memory data) {
        if(data.length == 0) revert ZeroData();
        _;
    }

    modifier nonZeroAmount(uint256 amount) {
        if(amount == 0) revert ZeroAmount();
        _;
    }

    modifier onlySelf() {
        if(address(this) != msg.sender) revert Unauthorized();
        _;
    }

    receive() external payable nonZeroAmount(msg.value){
        emit Deposited(msg.sender, msg.value);        
    }

    function isExecutable(Transaction memory txn) internal view returns(bool) {
        if(txn.confirmationCount == 0) return false;
        uint256 leastConfirmationNeeded = owners.length / 2;
        if(leastConfirmationNeeded < txn.confirmationCount){
            return true;
        }else {
            return false;
        }
    }

    function execute(uint256 txnId) internal returns(bool) {
        Transaction memory txn = transactions[txnId];
        if(block.timestamp > txn.expiresAt) revert TransactionExpired(txn.expiresAt);
        transactions[txnId].executed = true;
        
        (bool ok, ) = txn.to.call{value: txn.value}(txn.data);
        return ok;
    }

    function propose(address to, uint256 value, bytes memory data) external nonZeroAddress(to) nonZeroBytes(data) onlyOwner {

        Transaction memory txn = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmationCount: 1,
            expiresAt: block.timestamp + expiryDuration
        });

        uint256 txnIndex = transactions.length;

        transactions.push(txn);
        confirmed[txnIndex][msg.sender] = true;

        bool proceed = isExecutable(txn);
        if(proceed){
            bool success = execute(txnIndex);
            if(!success) revert TransactionFailed();
            emit TransactionConfirmed(transactions[txnIndex]);
        }

        emit ProposerGiven(txn);
    }

    function confirm(uint256 txnId) external onlyOwner {
        if(transactions[txnId].executed) revert AlreadyExecuted();
        if(transactions[txnId].expiresAt < block.timestamp) revert TransactionExpired(transactions[txnId].expiresAt);
        if(confirmed[txnId][msg.sender]) revert AlreadyConfirmed();

        transactions[txnId].confirmationCount += 1;
        confirmed[txnId][msg.sender] = true;
        bool proceed = isExecutable(transactions[txnId]);
        if(proceed){
            bool success = execute(txnId);
            if(!success) revert TransactionFailed();
            emit TransactionConfirmed(transactions[txnId]);
        }
        emit ConfirmedTxn(msg.sender, transactions[txnId]);
    }

    function revoke(uint256 txnId) external onlyOwner{
        if(!confirmed[txnId][msg.sender]) revert NotConfirmed();
        if(transactions[txnId].executed) revert AlreadyExecuted();

        confirmed[txnId][msg.sender] = false;
        transactions[txnId].confirmationCount -= 1;
        emit RevokedConfirmation(msg.sender, transactions[txnId]);
    }

    function addOwner(address newOwner) external onlySelf {
        if(newOwner == address(0)) revert ZeroAddress();
        if(isOwner[newOwner]) revert AlreadyOwner();
        owners.push(newOwner);
        ownerIndex[newOwner] = owners.length - 1 ;
        isOwner[newOwner] = true;
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) external onlySelf {
        if(owner == address(0)) revert ZeroAddress();
        if(!isOwner[owner]) revert NotOwner();
        if(owners.length == 1) revert MinimumOwnerLimit();
        if(ownerIndex[owner] != owners.length - 1) {
            address lastIndexedOwner = owners[owners.length - 1];
            owners[ownerIndex[owner]] = lastIndexedOwner;
            ownerIndex[lastIndexedOwner] = ownerIndex[owner];
        }
        owners.pop();
        isOwner[owner] = false;
        delete ownerIndex[owner];
        emit OwnerRemoved(owner);
    }
   
}