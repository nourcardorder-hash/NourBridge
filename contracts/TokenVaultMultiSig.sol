// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TokenVaultMultiSig
 * @dev Multi-signature token vault for USDC and MATIC with meta-transaction support
 * @notice High-security vault with multiple signers required for withdrawals
 */
contract TokenVaultMultiSig is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant MAX_SIGNERS = 10;
    uint256 public constant MIN_SIGNERS = 2;
    bytes32 public constant DOMAIN_SEPARATOR = keccak256("TokenVaultMultiSig");

    // State variables
    IERC20 public usdcToken;
    address[] public signers;
    mapping(address => bool) public isSignerMap;
    uint256 public requiredSignatures;

    // Withdrawal request tracking
    struct WithdrawalRequest {
        address recipient;
        uint256 amount;
        address token;
        uint256 requestTime;
        uint256 approvals;
        bool executed;
        mapping(address => bool) approvedBy;
    }

    uint256 private withdrawalCounter;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    // Whitelisted addresses for deposits
    mapping(address => bool) public whitelistedReceivers;
    bool public whitelistEnabled = true;

    // Rate limiting
    mapping(address => uint256) public lastWithdrawalTime;
    uint256 public withdrawalCooldown = 1 hours;

    // Meta-transaction nonce for replay protection
    mapping(address => uint256) public nonces;

    // Events
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event RequiredSignaturesChanged(uint256 newRequired);
    event WithdrawalRequested(uint256 indexed requestId, address indexed recipient, uint256 amount, address token);
    event WithdrawalApproved(uint256 indexed requestId, address indexed approver);
    event WithdrawalExecuted(uint256 indexed requestId, address indexed recipient, uint256 amount, address token);
    event WithdrawalRejected(uint256 indexed requestId);
    event ReceiverWhitelisted(address indexed receiver);
    event ReceiverRemovedFromWhitelist(address indexed receiver);
    event TokenDeposited(address indexed from, uint256 amount, address token);
    event MetaTransactionExecuted(address indexed from, address indexed to, bytes data);

    // Modifiers
    modifier onlySigner() {
        require(isSignerMap[msg.sender], "Only signers can call this");
        _;
    }

    modifier validSignerCount(uint256 count) {
        require(count >= MIN_SIGNERS && count <= MAX_SIGNERS, "Invalid signer count");
        _;
    }

    modifier rateLimit() {
        require(
            block.timestamp >= lastWithdrawalTime[msg.sender] + withdrawalCooldown,
            "Withdrawal cooldown not met"
        );
        _;
    }

    /**
     * @dev Initialize the vault with initial signers and USDC token address
     * @param initialSigners Array of initial signer addresses (must be >= 2)
     * @param _usdcToken Address of USDC token on Polygon
     * @param _requiredSignatures Number of signatures required for withdrawal
     */
    constructor(
        address[] memory initialSigners,
        address _usdcToken,
        uint256 _requiredSignatures
    ) validSignerCount(initialSigners.length) {
        require(_requiredSignatures <= initialSigners.length, "Required signatures exceeds signers");
        require(_usdcToken != address(0), "Invalid USDC address");

        usdcToken = IERC20(_usdcToken);
        requiredSignatures = _requiredSignatures;

        for (uint256 i = 0; i < initialSigners.length; i++) {
            require(initialSigners[i] != address(0), "Invalid signer address");
            require(!isSignerMap[initialSigners[i]], "Duplicate signer");

            signers.push(initialSigners[i]);
            isSignerMap[initialSigners[i]] = true;
            emit SignerAdded(initialSigners[i]);
        }
    }

    /**
     * @dev Add a new signer to the vault
     * @param _newSigner Address of new signer
     */
    function addSigner(address _newSigner) external onlyOwner validSignerCount(signers.length + 1) {
        require(_newSigner != address(0), "Invalid address");
        require(!isSignerMap[_newSigner], "Already a signer");

        signers.push(_newSigner);
        isSignerMap[_newSigner] = true;
        emit SignerAdded(_newSigner);
    }

    /**
     * @dev Remove a signer from the vault
     * @param _signer Address of signer to remove
     */
    function removeSigner(address _signer) external onlyOwner validSignerCount(signers.length - 1) {
        require(isSignerMap[_signer], "Not a signer");
        require(requiredSignatures <= signers.length - 1, "Cannot remove signer below required threshold");

        isSignerMap[_signer] = false;
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == _signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        emit SignerRemoved(_signer);
    }

    /**
     * @dev Update required signatures for withdrawal approval
     * @param _requiredSignatures New number of required signatures
     */
    function setRequiredSignatures(uint256 _requiredSignatures) external onlyOwner {
        require(_requiredSignatures >= MIN_SIGNERS && _requiredSignatures <= signers.length, "Invalid value");
        requiredSignatures = _requiredSignatures;
        emit RequiredSignaturesChanged(_requiredSignatures);
    }

    /**
     * @dev Add address to whitelist for deposits
     * @param _receiver Address to whitelist
     */
    function whitelistReceiver(address _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid address");
        whitelistedReceivers[_receiver] = true;
        emit ReceiverWhitelisted(_receiver);
    }

    /**
     * @dev Remove address from whitelist
     * @param _receiver Address to remove
     */
    function removeFromWhitelist(address _receiver) external onlyOwner {
        whitelistedReceivers[_receiver] = false;
        emit ReceiverRemovedFromWhitelist(_receiver);
    }

    /**
     * @dev Toggle whitelist enforcement
     */
    function toggleWhitelist() external onlyOwner {
        whitelistEnabled = !whitelistEnabled;
    }

    /**
     * @dev Deposit USDC tokens to the vault (NO GAS FEES - handled by relayer)
     * @param amount Amount of USDC to deposit
     */
    function depositUSDC(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(!whitelistEnabled || whitelistedReceivers[msg.sender], "Sender not whitelisted");

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        emit TokenDeposited(msg.sender, amount, address(usdcToken));
    }

    /**
     * @dev Deposit MATIC (native currency) to the vault
     */
    function depositMATIC() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Amount must be > 0");
        require(!whitelistEnabled || whitelistedReceivers[msg.sender], "Sender not whitelisted");

        emit TokenDeposited(msg.sender, msg.value, address(0));
    }

    /**
     * @dev Request withdrawal of tokens - requires approval from multiple signers
     * @param recipient Recipient address
     * @param amount Amount to withdraw
     * @param token Token address (address(0) for MATIC)
     */
    function requestWithdrawal(
        address recipient,
        uint256 amount,
        address token
    ) external onlySigner nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(token == address(usdcToken) || token == address(0), "Invalid token");

        uint256 requestId = withdrawalCounter++;
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        request.recipient = recipient;
        request.amount = amount;
        request.token = token;
        request.requestTime = block.timestamp;
        request.approvals = 0;
        request.executed = false;

        emit WithdrawalRequested(requestId, recipient, amount, token);
    }

    /**
     * @dev Approve a withdrawal request
     * @param requestId ID of the withdrawal request
     */
    function approveWithdrawal(uint256 requestId) external onlySigner nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(!request.executed, "Already executed");
        require(!request.approvedBy[msg.sender], "Already approved by this signer");
        require(request.requestTime != 0, "Invalid request");

        request.approvedBy[msg.sender] = true;
        request.approvals++;

        emit WithdrawalApproved(requestId, msg.sender);
    }

    /**
     * @dev Execute withdrawal after sufficient approvals
     * @param requestId ID of the withdrawal request
     */
    function executeWithdrawal(uint256 requestId) external onlySigner nonReentrant rateLimit {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(!request.executed, "Already executed");
        require(request.approvals >= requiredSignatures, "Insufficient approvals");
        require(request.requestTime != 0, "Invalid request");

        // Check token balance
        if (request.token == address(0)) {
            require(address(this).balance >= request.amount, "Insufficient MATIC balance");
        } else {
            require(usdcToken.balanceOf(address(this)) >= request.amount, "Insufficient token balance");
        }

        request.executed = true;
        lastWithdrawalTime[msg.sender] = block.timestamp;

        // Execute transfer
        if (request.token == address(0)) {
            (bool success, ) = request.recipient.call{value: request.amount}("");
            require(success, "MATIC transfer failed");
        } else {
            usdcToken.safeTransfer(request.recipient, request.amount);
        }

        emit WithdrawalExecuted(requestId, request.recipient, request.amount, request.token);
    }

    /**
     * @dev Reject a withdrawal request
     * @param requestId ID of the withdrawal request
     */
    function rejectWithdrawal(uint256 requestId) external onlySigner {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(!request.executed, "Already executed");
        request.executed = true;

        emit WithdrawalRejected(requestId);
    }

    /**
     * @dev Get all signers
     */
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /**
     * @dev Get signer count
     */
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /**
     * @dev Check USDC balance in vault
     */
    function getUSDCBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    /**
     * @dev Check MATIC balance in vault
     */
    function getMATICBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get withdrawal request details
     * @param requestId ID of the withdrawal request
     */
    function getWithdrawalRequest(uint256 requestId)
        external
        view
        returns (
            address recipient,
            uint256 amount,
            address token,
            uint256 requestTime,
            uint256 approvals,
            bool executed
        )
    {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        return (request.recipient, request.amount, request.token, request.requestTime, request.approvals, request.executed);
    }

    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Receive MATIC transfers
     */
    receive() external payable {
        emit TokenDeposited(msg.sender, msg.value, address(0));
    }
}
