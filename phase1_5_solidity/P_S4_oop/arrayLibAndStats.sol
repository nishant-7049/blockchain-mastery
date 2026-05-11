// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error EmptyArray();
error DuplicateValue(uint256 duplicateValue);

library ArrayLib {
    function contains(uint256[] memory arr, uint256 val) internal pure returns(bool) {
        for(uint256 i = 0; i<arr.length; i++){
            if(arr[i] == val) return true;
        }
        return false;
    }
    function sum(uint256[] memory arr) internal pure returns(uint256){
        uint256 sum = 0;
        for(uint256 i = 0; i<arr.length; i++){
            sum += arr[i];
        }   
        return sum;
    }
    function max(uint256[] memory arr) internal pure returns(uint256){
        if(arr.length == 0 ) revert EmptyArray();
        uint256 max = 0;
        for(uint256 i = 0; i<arr.length; i++){
            if(arr[i]>max) max = arr[i];
        }
        return max;
    }
}

contract Stats {
    using ArrayLib for uint256[];
    uint256[] public data;

    function add(uint256 val) external {
        if(data.contains(val)) revert DuplicateValue(val);

        data.push(val);
    }

    function total() external view returns(uint256) {
        return data.sum();
    }

    function largest() external view returns(uint256) {
        return data.max();
    }
}