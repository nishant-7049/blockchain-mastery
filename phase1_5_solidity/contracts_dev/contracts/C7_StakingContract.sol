// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error ZeroAmount();
error SameMinStakeAmount();
error SameMinStakeDuration();
error SameApyBps();
error MinStakingAmount(uint256 minStakeAmount);
error TransferFailed();
error AlreadyStaked();
error StakesNotFound();
error InsufficientBalanceInRewardPool(uint256 currentPoolBalance);
error Unauthorized();


contract StakingContract {

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardsDeposited(uint256 amount);
    event APYUpdated(uint256 oldApyBps, uint256 newApyBps);
    event MinStakeAmountUpdated(uint256 oldMinStakeAmount, uint256 newMinStakeAmount);
    event MinStakeDurationUpdated(uint256 oldMinStakeDuration, uint256 newMinStakeDuration);

    struct Stake {
        uint256 amount;
        uint256 startTime;
    }

    address public immutable owner;
    address public immutable stakingToken;
    uint256 public apyBps;
    uint256 public minStakeAmount;
    uint256 public minLockDuration;
    uint256 public rewardPool;
    mapping(address => Stake) public stakes;
    

    constructor(address _stakingToken) {
        owner = msg.sender;
        stakingToken = _stakingToken;
        apyBps = 1000;
        minStakeAmount = 100;
        minLockDuration = 31536000;
    }

    modifier notZeroAmount(uint256 amount) {
        if(amount == 0) revert ZeroAmount();
        _;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    function stake(uint256 _amount) external notZeroAmount(_amount) {
        if(_amount < minStakeAmount) revert MinStakingAmount(minStakeAmount);
        if(stakes[msg.sender].startTime != 0) revert AlreadyStaked();
        IERC20 token = IERC20(stakingToken);
        bool ok = token.transferFrom(msg.sender, address(this), _amount);
        if(!ok) revert TransferFailed();

        stakes[msg.sender] = Stake({
            amount: _amount,
            startTime: block.timestamp
        });

        emit Staked(msg.sender, _amount);
    }

    function unstake() external {
        Stake storage userStake = stakes[msg.sender];
        if(userStake.startTime == 0) revert StakesNotFound();
        uint256 rewards = 0;
        if(block.timestamp >= userStake.startTime + minLockDuration){
            rewards = userStake.amount * apyBps * (block.timestamp - userStake.startTime) / (365 days * 10000);
        }
        if(rewards > rewardPool) revert InsufficientBalanceInRewardPool(rewardPool);
        IERC20 token = IERC20(stakingToken);
        uint256 amount = userStake.amount;
        uint256 totalAmount = amount + rewards;
        delete stakes[msg.sender];
        rewardPool -= rewards;

        bool ok = token.transfer(msg.sender, totalAmount);
        if(!ok) revert TransferFailed();

        emit Unstaked(msg.sender, amount, rewards);
    }

    function depositRewards(uint256 amount) external onlyOwner {
        IERC20 token = IERC20(stakingToken);
        rewardPool += amount;

        bool ok = token.transferFrom(owner, address(this), amount);
        if(!ok) revert TransferFailed();

        emit RewardsDeposited(amount);
    }

    function setApy(uint256 _apyBps) external onlyOwner {
        if(apyBps == _apyBps) revert SameApyBps();
        uint256 oldApyBps = apyBps;
        apyBps = _apyBps;
        emit APYUpdated(oldApyBps, apyBps);
    }

    function setMinStakeAmount(uint256 amount) external onlyOwner {
        if(minStakeAmount == amount) revert SameMinStakeAmount();
        uint256 oldMinStakeAmount = minStakeAmount;
        minStakeAmount = amount;
        emit MinStakeAmountUpdated(oldMinStakeAmount, minStakeAmount);
    }

    function setMinStakeDuration(uint256 duration) external onlyOwner {
        if(minLockDuration == duration) revert SameMinStakeDuration();
        uint256 oldMinStakeDuration = minLockDuration;
        minLockDuration = duration;
        emit MinStakeDurationUpdated(oldMinStakeDuration, minLockDuration);
    }

    function pendingReward(address user) external view returns(uint256) {
        Stake memory userStake = stakes[user];
        if(userStake.startTime == 0) revert StakesNotFound();
        uint256 rewards = 0;
        if(block.timestamp >= userStake.startTime + minLockDuration){
            rewards = userStake.amount * apyBps * (block.timestamp - userStake.startTime) / (365 days * 10000);
        }
        return rewards;       
    }
}