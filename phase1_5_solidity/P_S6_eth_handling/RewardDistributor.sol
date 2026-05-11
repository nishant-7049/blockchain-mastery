// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


error InvalidAddress();
error NotWinner();
error AlreadyClaimed();

contract RewardDistributor {
    address[] public winners;
    uint256 public rewardPerWinner;
    address public immutable owner;
    mapping(address => bool) public hasClaimed;

    constructor() payable {
        owner = msg.sender;
        rewardPerWinner = msg.value;
    }

    function addWinner(address winner) external {
        require(msg.sender == owner);
        winners.push(winner);
        rewardPerWinner = address(this).balance / winners.length;
    }

    function _isWinner(address winner) internal view returns(bool) {
        if(address(0) == winner) revert InvalidAddress();
        for( uint256 i = 0; i<winners.length; i++){
            if(winners[i] == winner) return true;
        }
        return false;
    }

    function claimReward() external {
        if(!_isWinner(msg.sender)) revert NotWinner();
        if(hasClaimed[msg.sender]) revert AlreadyClaimed();

        hasClaimed[msg.sender] = true;
        (bool ok, ) = payable(msg.sender).call{value: rewardPerWinner}("");
        if(!ok) revert("Transfer Failed");
    }
}