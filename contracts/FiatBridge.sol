// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title FiatBridge
 * @dev Bridge contract for converting between Fiat and Crypto
 */
contract FiatBridge is Ownable, ReentrancyGuard, Pausable {
    
    // Token to fiat mapping
    struct TokenInfo {
        address tokenAddress;
        string symbol;
        uint8 decimals;
        bool isActive;
        uint256 minAmount;
        uint256 maxAmount;
    }

    // Conversion rates (stored as scaled integers, e.g., 1 ETH = 2000 USD means 2000e6)
    mapping(bytes32 => uint256) public conversionRates;
    
    // Token info
    mapping(address => TokenInfo) public tokenInfo;
    
    // Deposit tracking
    mapping(address => uint256) public userDeposits;
    mapping(bytes32 => bool) public processedTransactions;
    
    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event ConversionRateUpdated(bytes32 indexed pair, uint256 newRate);
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token);

    address public feeCollector;
    uint256 public feePercentage = 5; // 0.5% fee

    constructor(address _feeCollector) {
        feeCollector = _feeCollector;
    }

    /**
     * @dev Deposit crypto to bridge
     */
    function depositCrypto(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(tokenInfo[token].isActive, "Token not supported");
        require(amount >= tokenInfo[token].minAmount, "Amount below minimum");
        require(amount <= tokenInfo[token].maxAmount, "Amount exceeds maximum");

        // Transfer tokens from user to contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Calculate fee
        uint256 fee = (amount * feePercentage) / 1000;
        uint256 netAmount = amount - fee;

        userDeposits[msg.sender] += netAmount;

        // Send fee to collector
        if (fee > 0) {
            IERC20(token).transfer(feeCollector, fee);
        }

        emit Deposit(msg.sender, token, netAmount, block.timestamp);
    }

    /**
     * @dev Withdraw crypto from bridge
     */
    function withdrawCrypto(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(userDeposits[msg.sender] >= amount, "Insufficient balance");
        require(tokenInfo[token].isActive, "Token not supported");

        userDeposits[msg.sender] -= amount;

        // Transfer tokens back to user
        IERC20(token).transfer(msg.sender, amount);

        emit Withdrawal(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev Get conversion rate between token and fiat
     */
    function getConversionRate(address token, string memory fiat) external view returns (uint256) {
        bytes32 pair = keccak256(abi.encodePacked(token, fiat));
        return conversionRates[pair];
    }

    /**
     * @dev Update conversion rate (only owner)
     */
    function setConversionRate(address token, string memory fiat, uint256 rate) external onlyOwner {
        bytes32 pair = keccak256(abi.encodePacked(token, fiat));
        conversionRates[pair] = rate;
        emit ConversionRateUpdated(pair, rate);
    }

    /**
     * @dev Add supported token
     */
    function addToken(
        address tokenAddress,
        string memory symbol,
        uint8 decimals,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyOwner {
        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            symbol: symbol,
            decimals: decimals,
            isActive: true,
            minAmount: minAmount,
            maxAmount: maxAmount
        });
        emit TokenAdded(tokenAddress, symbol);
    }

    /**
     * @dev Remove supported token
     */
    function removeToken(address tokenAddress) external onlyOwner {
        tokenInfo[tokenAddress].isActive = false;
        emit TokenRemoved(tokenAddress);
    }

    /**
     * @dev Update fee percentage (only owner)
     */
    function setFeePercentage(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high"); // Max 10%
        feePercentage = newFee;
    }

    /**
     * @dev Pause/unpause bridge
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal
     */
    function emergencyWithdraw(address token) external onlyOwner {
        IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
    }

    /**
     * @dev Get user balance
     */
    function getUserBalance(address user) external view returns (uint256) {
        return userDeposits[user];
    }
}
