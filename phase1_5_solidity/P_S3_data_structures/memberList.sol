// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

error Unauthorized(address caller, address owner);
error InvalidAddress(address member);
error AlreadyMember(address member);
error NotMember(address member);

contract MemberList {
    address public immutable owner;
    address[] public members;
    mapping(address => bool) public isMember;
    mapping(address => uint256) public memberIndex;

    constructor() {
        owner = msg.sender;
    }

    function addMember(address newMember) external {
        if(newMember == address(0)) revert InvalidAddress(newMember);
        if(msg.sender != owner) revert Unauthorized(msg.sender, owner);
        if(isMember[newMember]) revert AlreadyMember(newMember);

        members.push(newMember);
        memberIndex[newMember] = members.length - 1;
        isMember[newMember] = true;
    }

    function removeMember(address _member) external {
        if(msg.sender != owner) revert Unauthorized(msg.sender, owner);
        if(isMember[_member]==false) revert NotMember(_member);

        uint256 currentMemberIndex = memberIndex[_member];
        address lastMember = members[members.length -1];
        members[currentMemberIndex] = lastMember;
        memberIndex[lastMember] = currentMemberIndex;
        isMember[_member] = false;
        members.pop();
        delete memberIndex[_member];
    }

    function getMemberCount() external view returns(uint256) {
        return members.length;
    }
}