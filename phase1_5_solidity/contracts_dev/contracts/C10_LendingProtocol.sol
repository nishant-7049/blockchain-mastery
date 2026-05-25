// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error ZeroAddress();
error ZeroAmount();
error ZeroPrice();
error InvalidInterest();
error ZeroValue();
error InsufficientCollateral(uint256 currentcollateral);
error TransferFailed();
error PayingMore(uint256 currentDebt);
error UserDebtsAreHealthy();
error Unauthorized();
error InsufficientReserve(uint256 currentReserveBalance);
error SamePrice();

contract LendingProtocol {

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount, uint256 shares);
    event Repayed(address indexed user, uint256 amount, uint256 shares);
    event Liquidated(address indexed liquidator, address indexed user, uint256 repayAmount, uint256 collateralSiezed);
    event ReserveDeposited(uint256 amount);
    event EthPriceUpdated(uint256 oldPrice, uint256 newPrice);

    struct Position {
        uint256 collateral;
        uint256 debtShares;
    }

    address public immutable owner;
    address public immutable borrowToken;
    uint256 public ethPrice;
    uint256 public immutable interestPerSecond;
    uint256 public constant COLLATERAL_RATIO = 150;
    uint256 public constant LIQUIDATION_BONUS = 500;
    uint256 public totalDebt;
    uint256 public totalDebtShares;
    uint256 public reserveBalance;
    uint256 public lastAccrualTimestamp;
    mapping(address => Position) public positions;

    constructor(address _borrowToken, uint256 _ethPrice, uint256 _interestPerSecond) {
        if(_borrowToken == address(0)) revert ZeroAddress();
        if(_ethPrice == 0) revert ZeroPrice();
        if(_interestPerSecond == 0) revert InvalidInterest();
        owner = msg.sender;
        borrowToken = _borrowToken;
        ethPrice = _ethPrice;
        interestPerSecond = _interestPerSecond;
        lastAccrualTimestamp = block.timestamp;
    }

    modifier onlyOwner() {
        if(msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier notZeroAmount(uint256 amount) {
        if(amount == 0) revert ZeroAmount();
        _;
    }

    receive() external payable {
        if(msg.value == 0) revert ZeroValue();
        positions[msg.sender].collateral += msg.value;

        emit CollateralDeposited(msg.sender, msg.value);

    }

    function depositCollateral() external payable {
        if(msg.value == 0) revert ZeroValue();
        positions[msg.sender].collateral += msg.value;

        emit CollateralDeposited(msg.sender, msg.value);
    }

    function getUserHealthFactor(uint256 collateral, uint256 debt) internal view returns(uint256) {
        if(debt == 0) return COLLATERAL_RATIO;
        uint256 collateralValue = collateral * ethPrice / 1e18;
        uint256 healthFactor = collateralValue * 100 / debt;
        return healthFactor;
    }

    function getUserDebt(uint256 debtShares) internal view returns(uint256) {
        if(totalDebtShares == 0) return 0;
        return debtShares * totalDebt / totalDebtShares;

    }

    function withdrawCollateral(uint256 amount) external notZeroAmount(amount ){
        accrueInterest();
        Position storage userPosition = positions[msg.sender];
        if(userPosition.collateral < amount) revert InsufficientCollateral(userPosition.collateral);

        uint256 remainingCollateral = userPosition.collateral - amount;
        uint256 userDebt = getUserDebt(userPosition.debtShares);
        uint256 userHealthFactor = getUserHealthFactor(remainingCollateral, userDebt);

        if(userHealthFactor < COLLATERAL_RATIO) revert InsufficientCollateral(userPosition.collateral);

        userPosition.collateral -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if(!ok) revert TransferFailed();

        emit CollateralWithdrawn(msg.sender, amount);
    }

    function getDebtShare(uint256 debt) internal view returns(uint256){
        if(totalDebtShares == 0) return debt;
        return totalDebtShares * debt / totalDebt;
    }


    function borrow(uint256 amount) external notZeroAmount(amount) {
        Position storage userPosition = positions[msg.sender];

        accrueInterest();

        uint256 userDebt = getUserDebt(userPosition.debtShares);
        uint256 newUserDebt = userDebt + amount;

        uint256 userHealthFactor = getUserHealthFactor(userPosition.collateral, newUserDebt);

        if(userHealthFactor < COLLATERAL_RATIO) revert InsufficientCollateral(userPosition.collateral);
        if(reserveBalance < amount) revert InsufficientReserve(reserveBalance);

        uint256 newShares = getDebtShare(amount);
        userPosition.debtShares += newShares;
        totalDebtShares += newShares;
        totalDebt += amount;

        reserveBalance -= amount;

        IERC20(borrowToken).transfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount, newShares);    
  }

    function repay(uint256 amount) external notZeroAmount(amount) {
        Position storage userPosition = positions[msg.sender];

        accrueInterest();

        uint256 userCurrentDebt = getUserDebt(userPosition.debtShares);
        if(amount > userCurrentDebt) revert PayingMore(userCurrentDebt); 
        uint256 sharesToRemove = amount * totalDebtShares / totalDebt;
        userPosition.debtShares -= sharesToRemove;
        totalDebtShares -= sharesToRemove;
        totalDebt -= amount;

        reserveBalance += amount;

        IERC20(borrowToken).transferFrom(msg.sender, address(this), amount);

        emit Repayed(msg.sender, amount, sharesToRemove);
    }

    function liquidate(address user, uint256 repayAmount) external notZeroAmount(repayAmount) {
        Position storage userPosition = positions[user];

        accrueInterest();

        uint256 userDebt = getUserDebt(userPosition.debtShares);
        uint256 healthFactor = getUserHealthFactor(userPosition.collateral, userDebt);
        if(healthFactor >= COLLATERAL_RATIO) revert UserDebtsAreHealthy();
        if(repayAmount > userDebt) revert PayingMore(userDebt);
        uint256 newDebt = userDebt - repayAmount;

        uint256 debtDiff = userDebt - newDebt;
        uint256 debtShareDiff = repayAmount * totalDebtShares / totalDebt;
        uint256 repayEth = repayAmount * 1e18 / ethPrice;
        totalDebt -= debtDiff;
        totalDebtShares -= debtShareDiff;
        userPosition.debtShares -= debtShareDiff;

        reserveBalance += repayAmount;

        uint256 bonus = repayEth * LIQUIDATION_BONUS / 10000;
        uint256 totalEthSeized = repayEth + bonus;
        if(totalEthSeized > userPosition.collateral) totalEthSeized = userPosition.collateral; // cap at available
        userPosition.collateral -= totalEthSeized;

        (bool ok, ) = payable(msg.sender).call{value: totalEthSeized}("");
        if(!ok) revert TransferFailed();
        emit Liquidated(msg.sender, user, repayAmount, totalEthSeized);

    }

    function depositReserve(uint256 amount) external onlyOwner notZeroAmount(amount) {
        reserveBalance += amount;

        IERC20(borrowToken).transferFrom(msg.sender, address(this), amount);
        emit ReserveDeposited(amount);        
    }

    function setEthPrice(uint256 price) external onlyOwner notZeroAmount(price) {
        if(ethPrice == price) revert SamePrice();

        uint256 oldEthPrice = ethPrice;
        ethPrice = price;
        emit EthPriceUpdated(oldEthPrice, ethPrice);
    }

    function accrueInterest() internal {
        if(totalDebt == 0) return;
        uint256 elapsedTime = block.timestamp - lastAccrualTimestamp;
        uint256 interest = totalDebt * interestPerSecond * elapsedTime / 1e18;
        totalDebt += interest;
        lastAccrualTimestamp = block.timestamp;
    }

    function getDebt() external returns(uint256) {
        accrueInterest();
        return getUserDebt(positions[msg.sender].debtShares);
    }

    function getHealthFactor(address user) external returns(uint256) {
        accrueInterest();
        Position memory currentPosition = positions[user];
        uint256 debt = getUserDebt(currentPosition.debtShares);
        return getUserHealthFactor(currentPosition.collateral, debt);
    }

}