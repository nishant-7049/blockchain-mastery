# C6 — Voting Contract

## Overview

Owner-controlled governance contract. Owner creates proposals and registers voters with weights. Registered voters cast weighted yes/no votes within a deadline. After deadline, anyone can finalize — result is recorded on-chain.

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `owner` | `address immutable` | Controls proposal creation and voter registration |
| `proposals` | `Proposal[]` | All proposals |
| `voters` | `mapping(address => Voter)` | Registered voter info |
| `votes` | `mapping(uint256 => mapping(address => Vote))` | Vote cast per proposal per voter |

## Structs

```
struct Voter {
    bool registered
    uint256 weight
}

struct Proposal {
    string title
    string description
    uint256 deadline        // block.timestamp — voting closes after this
    uint256 yesWeight       // total weight of yes votes
    uint256 noWeight        // total weight of no votes
    uint256 voterCount      // number of voters who voted
    bool finalized
    bool passed             // only valid if finalized == true
}

enum Vote { None, Yes, No }
```

## Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerVoter(address voter, uint256 weight)` | owner only | Register a voter with a weight. Can update weight if not yet voted on any active proposal. |
| `createProposal(string title, string description, uint256 duration)` | owner only | Creates a new proposal. `deadline = block.timestamp + duration` |
| `vote(uint256 proposalId, Vote choice)` | registered voters only | Cast yes or no vote. Weight added to tally. |
| `finalize(uint256 proposalId)` | anyone | After deadline, mark proposal passed or failed. `passed = yesWeight > noWeight` |

## Rules

- Voter cannot vote twice on the same proposal
- Voter cannot vote after deadline
- Cannot finalize before deadline
- Cannot vote on a finalized proposal
- Weight must be > 0 to register
- `duration` must be > 0 when creating proposal

## Events

| Event | When |
|-------|------|
| `VoterRegistered(address indexed voter, uint256 weight)` | Voter registered or weight updated |
| `ProposalCreated(uint256 indexed proposalId, string title, uint256 deadline)` | New proposal created |
| `Voted(uint256 indexed proposalId, address indexed voter, Vote choice, uint256 weight)` | Vote cast |
| `ProposalFinalized(uint256 indexed proposalId, bool passed, uint256 yesWeight, uint256 noWeight, uint256 voterCount)` | Proposal finalized |

## Errors

| Error | When |
|-------|------|
| `Unauthorized()` | Non-owner calls restricted function |
| `NotRegistered()` | Unregistered address tries to vote |
| `AlreadyVoted()` | Voter already voted on this proposal |
| `VotingClosed()` | Voting deadline has passed |
| `VotingStillOpen()` | Finalize called before deadline |
| `AlreadyFinalized()` | Finalize called on already finalized proposal |
| `ProposalDoesNotExist()` | proposalId out of range |
| `ZeroWeight()` | Registering voter with weight 0 |
| `ZeroDuration()` | Creating proposal with duration 0 |
| `InvalidVote()` | Vote choice is None |
