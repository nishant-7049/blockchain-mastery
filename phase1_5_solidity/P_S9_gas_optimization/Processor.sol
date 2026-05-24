// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Processor {

    event Processed(address sender, uint256 total);

    function sum(uint256[] calldata numbers) external pure returns (uint256 total) {
        for (uint256 i = 0; i < numbers.length; ++i) {
            total += numbers[i];
        }
    }

    function contains(address[] calldata list, address target) external pure returns (bool) {
        for (uint256 i = 0; i < list.length; ++i) {
            if (list[i] == target) return true;
        }
        return false;
    }

    function processAndEmit(uint256[] calldata data) external returns (uint256 total) {
        for (uint256 i = 0; i < data.length; ++i) {
            total += data[i];
        }
        emit Processed(msg.sender, total);
    }
}