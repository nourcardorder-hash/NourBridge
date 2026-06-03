// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SwapRouter
 * @dev Router for token swaps and liquidity management
 */
contract SwapRouter is Ownable, ReentrancyGuard {
    
    struct SwapPair {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        bool isActive;
    }

    mapping(bytes32 => SwapPair) public swapPairs;
    mapping(address => bool) public isLiquidityProvider;
    
    uint256 public feePercentage = 25; // 0.25%
    address public feeCollector;

    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed provider, address tokenA, address tokenB, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed provider, address tokenA, address tokenB, uint256 amountA, uint256 amountB);
    event PairCreated(address indexed tokenA, address indexed tokenB);

    constructor(address _feeCollector) {
        feeCollector = _feeCollector;
    }

    /**
     * @dev Create swap pair
     */
    function createPair(address tokenA, address tokenB) external onlyOwner {
        bytes32 pairId = getPairId(tokenA, tokenB);
        require(!swapPairs[pairId].isActive, "Pair already exists");

        swapPairs[pairId] = SwapPair({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            isActive: true
        });

        emit PairCreated(tokenA, tokenB);
    }

    /**
     * @dev Add liquidity to pair
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant {
        bytes32 pairId = getPairId(tokenA, tokenB);
        require(swapPairs[pairId].isActive, "Pair does not exist");

        // Transfer tokens from user
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        // Update reserves
        swapPairs[pairId].reserveA += amountA;
        swapPairs[pairId].reserveB += amountB;

        isLiquidityProvider[msg.sender] = true;

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    /**
     * @dev Remove liquidity from pair
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant {
        bytes32 pairId = getPairId(tokenA, tokenB);
        require(swapPairs[pairId].isActive, "Pair does not exist");
        require(swapPairs[pairId].reserveA >= amountA, "Insufficient reserve A");
        require(swapPairs[pairId].reserveB >= amountB, "Insufficient reserve B");

        // Update reserves
        swapPairs[pairId].reserveA -= amountA;
        swapPairs[pairId].reserveB -= amountB;

        // Transfer tokens to user
        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    /**
     * @dev Execute token swap
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minAmountOut,
        address tokenIn,
        address tokenOut
    ) external nonReentrant returns (uint256 amountOut) {
        bytes32 pairId = getPairId(tokenIn, tokenOut);
        require(swapPairs[pairId].isActive, "Pair does not exist");

        SwapPair storage pair = swapPairs[pairId];

        // Calculate output amount (simplified AMM formula)
        uint256 amountInWithFee = amountIn * (1000 - feePercentage) / 1000;
        amountOut = (amountInWithFee * pair.reserveB) / (pair.reserveA + amountInWithFee);

        require(amountOut >= minAmountOut, "Slippage exceeded");

        // Calculate fee
        uint256 fee = (amountIn * feePercentage) / 1000;

        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).transfer(feeCollector, fee);
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        // Update reserves
        pair.reserveA += amountInWithFee;
        pair.reserveB -= amountOut;

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /**
     * @dev Get pair ID
     */
    function getPairId(address tokenA, address tokenB) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA, tokenB));
    }

    /**
     * @dev Get pair reserves
     */
    function getReserves(address tokenA, address tokenB) external view returns (uint256, uint256) {
        bytes32 pairId = getPairId(tokenA, tokenB);
        return (swapPairs[pairId].reserveA, swapPairs[pairId].reserveB);
    }

    /**
     * @dev Calculate output amount for given input
     */
    function getAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256) {
        bytes32 pairId = getPairId(tokenIn, tokenOut);
        require(swapPairs[pairId].isActive, "Pair does not exist");

        uint256 amountInWithFee = amountIn * (1000 - feePercentage) / 1000;
        return (amountInWithFee * swapPairs[pairId].reserveB) / (swapPairs[pairId].reserveA + amountInWithFee);
    }
}
