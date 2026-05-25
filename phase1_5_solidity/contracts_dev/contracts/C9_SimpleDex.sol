// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error ZeroAmount();
error InvalidRatio(uint256 currentRatio);
error InsufficientLpAmount(uint256 userLpAmount);
error InvalidToken(address supportedTokenA, address supportedTokenB);
error InvalidAddress();
error InvalidFeeBps();
error ZeroLiquidity();

contract SimpleDex {

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpMinted);
    event LiquidityBurned(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpBurned);
    event Swapped(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    address public immutable tokenA;
    address public immutable tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalSupply;
    uint256 public immutable feeBps;
    mapping(address => uint256) public balanceOf;
    uint256 public constant MIN_LIQUIDITY = 1000;

    constructor(address _tokenA, address _tokenB, uint256 _feeBps) {
        if(_tokenA == address(0) || _tokenB == address(0)) revert InvalidAddress();
        if(_feeBps == 0 || _feeBps >= 10000) revert InvalidFeeBps();
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeBps = _feeBps;
    }

    modifier notZeroAmount(uint256 amount) {
        if(amount == 0) revert ZeroAmount();
        _;
    }

    modifier tokenMustBe(address token) {
        if(token != tokenA && token != tokenB) revert InvalidToken(tokenA, tokenB);
        _;
    }

    function sqrt(uint256 y) internal pure returns(uint256 z) {
        if(y > 3) {
            z = y;
            uint256 x = y/2 + 1;
            while(x < z) {
                z = x;
                x = (y/x + x)/2;
            }
        }else if (y != 0) {
            z = 1;
        }
    }

    function minValue(uint256 amountA, uint256 amountB) internal pure returns(uint256) {
        if(amountA < amountB) {
            return amountA;
        }
        return amountB;
    }

    function firstDeposit(uint256 amountA, uint256 amountB) internal {
        uint256 liquidity = sqrt(amountA * amountB);
        if(liquidity < MIN_LIQUIDITY) revert ZeroLiquidity();
        uint256 lpMinted = liquidity - MIN_LIQUIDITY;
        totalSupply = lpMinted + MIN_LIQUIDITY;
        balanceOf[address(0)] = MIN_LIQUIDITY;
        balanceOf[msg.sender] = lpMinted;

        reserveA = amountA;
        reserveB = amountB;

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpMinted);
    }

    function subsequentDeposit(uint256 amountA, uint256 amountB) internal {
        if(amountA * reserveB != amountB * reserveA) revert InvalidRatio(reserveA/reserveB);

        uint256 tokenALp = amountA * totalSupply/reserveA ;
        uint256 tokenBLp = amountB * totalSupply/reserveB ;

        uint256 lpMinted = minValue(tokenALp, tokenBLp);
        
        balanceOf[msg.sender] += lpMinted;
        totalSupply += lpMinted;

        reserveA += amountA;
        reserveB += amountB;

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpMinted);

    }

    function addLiquidity(uint256 amountA, uint256 amountB) external notZeroAmount(amountA) notZeroAmount(amountB) {
        if(reserveA == 0 && reserveB == 0) {
            firstDeposit(amountA, amountB);
        }else {
            subsequentDeposit(amountA, amountB);
        }
    }

    function removeLiquidity(uint256 lpAmount) external notZeroAmount(lpAmount) {
        uint256 userLpAmount = balanceOf[msg.sender];
        if(userLpAmount < lpAmount) revert InsufficientLpAmount(userLpAmount);

        uint256 amountA = lpAmount * reserveA / totalSupply ;
        uint256 amountB = lpAmount * reserveB / totalSupply;

        totalSupply -= lpAmount;
        balanceOf[msg.sender] -= lpAmount;

        reserveA -= amountA;
        reserveB -= amountB;

        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);

        emit LiquidityBurned(msg.sender, amountA, amountB, lpAmount); 
    }

    function swap(address tokenIn, uint256 amountIn) external notZeroAmount(amountIn) tokenMustBe(tokenIn) {
        address tokenOut;
        uint256 amountOut;
        uint256 amountInFeeDeducted = amountIn *(10000 - feeBps);
        if(tokenIn == tokenA) {
            tokenOut = tokenB;
            amountOut = amountInFeeDeducted * reserveB / (reserveA * 10000 + amountInFeeDeducted);            
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            tokenOut = tokenA;
            amountOut = amountInFeeDeducted * reserveA / (reserveB * 10000 + amountInFeeDeducted);
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        emit Swapped(msg.sender, tokenIn, amountIn, amountOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut ) external view returns(uint256) {
        uint256 amountInWithFee = amountIn * (10000 - feeBps);
        uint256 amountOut = amountInWithFee * reserveOut / (reserveIn * 10000 + amountInWithFee);
        return amountOut;
    }
}