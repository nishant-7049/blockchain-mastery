// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error Unauthorized();
error ZeroAddress();
error ZeroValue();
error NotRegistered();
error InvalidChoice();
error InvalidProposalId();
error ProposalAlreadyFinalized();
error ProposalExpired();
error AlreadyVoted();
error EmptyString();
error VotingStillOpen();

contract VotingContract {

    event VoterRegistered(address indexed voter, uint256 weight);
    event ProposalCreated(uint256 indexed proposalId, string indexed title, uint256 deadline);
    event Voted(uint256 indexed proposalId, address indexed voter, Vote choice, uint256 weight);
    event ProposalFinalized(uint256 indexed proposalId, bool passed, uint256 yesWeight, uint256 noWeight, uint256 voterCount);

    struct Voter {
        bool registered;
        uint256 weight;
    }

    enum Vote {
        None,
        Yes,
        No
    }

    struct Proposal {
        string title;
        string description;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 voterCount;
        bool finalized;
        bool passed;
    }

    address public immutable owner;
    Proposal[] public proposals;
    mapping(address => Voter) public voters;
    mapping(uint256 => mapping(address => Vote)) public votes;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _; 
    }

    modifier notZeroAddress(address user) {
        if(address(0) == user) revert ZeroAddress();
        _;
    }

    modifier notZeroValue(uint256 value) {
        if(value == 0) revert ZeroValue();
        _;
    }

    function registerVoter(address voter, uint256 _weight) external notZeroAddress(voter) notZeroValue(_weight) onlyOwner {
        voters[voter] = Voter({
            registered: true,
            weight: _weight
        });

        emit VoterRegistered(voter, _weight);
    }

    modifier notEmptyString(string memory array) {
        if(keccak256(bytes(array)) == keccak256(bytes(""))) revert EmptyString();
        _;
    }

    function createProposal(string calldata _title, string calldata _description, uint256 duration) external notZeroValue(duration) notEmptyString(_title) notEmptyString(_description) onlyOwner {
        uint256 _deadline = block.timestamp + duration;
        proposals.push(Proposal({
            title: _title,
            description: _description,
            deadline: _deadline,
            yesVotes: 0,
            noVotes: 0,
            voterCount: 0,
            finalized: false,
            passed: false
        }));

        emit ProposalCreated(proposals.length - 1, _title, _deadline);
    }

    function vote(uint256 proposalId, Vote choice) external {
        if(choice == Vote.None) revert InvalidChoice();
        if(!voters[msg.sender].registered) revert NotRegistered();
        Proposal memory currentProposal = proposals[proposalId];
        if(keccak256(bytes(currentProposal.title)) == keccak256(bytes(""))) revert InvalidProposalId();
        if(currentProposal.finalized) revert ProposalAlreadyFinalized();
        if(currentProposal.deadline < block.timestamp) revert ProposalExpired();
        if(votes[proposalId][msg.sender] != Vote.None) revert AlreadyVoted();

        Voter memory voter = voters[msg.sender];

        if(choice == Vote.Yes) {
            proposals[proposalId].yesVotes += voter.weight;
        }else{
            proposals[proposalId].noVotes += voter.weight;
        }

        ++proposals[proposalId].voterCount;
        votes[proposalId][msg.sender] = choice;
        emit Voted(proposalId, msg.sender, choice, voter.weight);
    }

    function finalize(uint256 proposalId) external {
        Proposal storage currentProposal = proposals[proposalId];
        if(keccak256(bytes(currentProposal.title)) == keccak256(bytes(""))) revert InvalidProposalId();
        if(currentProposal.finalized) revert ProposalAlreadyFinalized();
        if(block.timestamp <= currentProposal.deadline) revert VotingStillOpen();

        if(currentProposal.yesVotes > currentProposal.noVotes){
            currentProposal.passed = true;
        }

        currentProposal.finalized = true;

        emit ProposalFinalized(proposalId, currentProposal.passed, currentProposal.yesVotes, currentProposal.noVotes, currentProposal.voterCount);
    }

}