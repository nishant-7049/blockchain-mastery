// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Registry {
    address[] public members;
    mapping(address => uint256) public scores;

    function totalScore() external view returns (uint256 total) {
        uint256 membersLength = members.length;
        for (uint256 i = 0; i < membersLength; ++i) {
            total += scores[members[i]];
        }
    }

    function topScore() external view returns (uint256 top) {
        uint256 membersLength = members.length;
        for (uint256 i = 0; i < membersLength; ++i) {
            uint256 currentScore = scores[members[i]];
            if (currentScore > top) {
                top = currentScore;
            }
        }
    }
}