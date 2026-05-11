// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

enum Phase {
        REGISTRATION,
        VOTING,
        ENDED
    }
error Unauthorized(address caller, address admin);
error AlreadyRegistered(string CandidateName);
error InvalidPhase(Phase currentPhase);
error AlreadyVoted(address caller);
error VotingOpen();
error NotEnoughCandidates();

contract VotingTally {

    struct Candidate{
        string name;
        uint256 voteCount;
        bool isRegistered;
    }

    Phase public currentPhase;
    mapping(uint256 => Candidate) public candidates;
    uint256[] public candidateIds;
    mapping(address => bool) public hasVoted;
    address public immutable admin;

    constructor() {
        admin = msg.sender;
        currentPhase = Phase.REGISTRATION;
    }

    function addCandidate(uint256 id, string calldata _name) external {
        if(msg.sender != admin) revert Unauthorized(msg.sender, admin);
        if(candidates[id].isRegistered) revert AlreadyRegistered(candidates[id].name);
        if(currentPhase != Phase.REGISTRATION) revert InvalidPhase(currentPhase);

        candidates[id] = Candidate({
            name: _name,
            voteCount: 0,
            isRegistered: true
        });
        candidateIds.push(id);
    }

    function startVoting() external {
        if(msg.sender != admin) revert Unauthorized(msg.sender, admin);
        if(currentPhase == Phase.VOTING || currentPhase == Phase.ENDED) revert InvalidPhase(currentPhase);

        currentPhase = Phase.VOTING;
    }

    function vote(uint256 candidateId) external {
        if(currentPhase != Phase.VOTING) revert InvalidPhase(currentPhase);
        if(hasVoted[msg.sender]) revert AlreadyVoted(msg.sender);

        candidates[candidateId].voteCount += 1;
        hasVoted[msg.sender] = true;
    }

    function endVoting() external {
        if(msg.sender != admin) revert Unauthorized(msg.sender, admin);
        if(currentPhase == Phase.ENDED || currentPhase == Phase.REGISTRATION) revert InvalidPhase(currentPhase);

        currentPhase = Phase.ENDED;
    }

    function getWinner() external view returns(Candidate memory){
        if(currentPhase != Phase.ENDED) revert VotingOpen();
        if(candidateIds.length == 0) revert NotEnoughCandidates();

        Candidate memory winnerCandidate = candidates[0];
        uint256 maxVotes = 0;  
        for(uint256 i = 0; i < candidateIds.length; i++){
            if(candidates[candidateIds[i]].voteCount>=maxVotes) {
                maxVotes = candidates[candidateIds[i]].voteCount;
                winnerCandidate = candidates[candidateIds[i]];
            }
        }
        return winnerCandidate;
    }
}