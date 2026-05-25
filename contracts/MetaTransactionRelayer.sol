// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./TokenVaultMultiSig.sol";

/**
 * @title MetaTransactionRelayer
 * @dev Handles meta-transactions for zero-gas deposits
 * @notice Allows deposits without paying gas fees by using a relayer
 */
contract MetaTransactionRelayer is EIP712 {
    using ECDSA for bytes32;

    TokenVaultMultiSig public vault;

    // Meta-transaction structure
    bytes32 public constant DEPOSIT_TYPEHASH =
        keccak256("DepositRequest(address depositor,uint256 amount,address token,uint256 nonce,uint256 deadline)");

    // Nonce for replay protection
    mapping(address => uint256) public nonces;

    // Events
    event MetaTransactionExecuted(address indexed depositor, uint256 amount, address token);
    event RelayerUpdated(address indexed newRelayer);

    address public relayer;

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer can execute");
        _;
    }

    constructor(
        address _vault,
        address _relayer,
        string memory name,
        string memory version
    ) EIP712(name, version) {
        vault = TokenVaultMultiSig(_vault);
        relayer = _relayer;
    }

    /**
     * @dev Update relayer address
     */
    function setRelayer(address _newRelayer) external {
        require(msg.sender == vault.owner(), "Only vault owner");
        relayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }

    /**
     * @dev Execute meta-transaction deposit (ZERO GAS FOR USER)
     * @param depositor User who is depositing
     * @param amount Amount to deposit
     * @param token Token address
     * @param deadline Signature deadline
     * @param signature User's signature
     */
    function executeMetaDeposit(
        address depositor,
        uint256 amount,
        address token,
        uint256 deadline,
        bytes calldata signature
    ) external onlyRelayer {
        require(block.timestamp <= deadline, "Signature expired");

        // Verify signature
        bytes32 structHash = keccak256(
            abi.encode(DEPOSIT_TYPEHASH, depositor, amount, token, nonces[depositor], deadline)
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        require(signer == depositor, "Invalid signature");

        // Increment nonce
        nonces[depositor]++;

        // Execute deposit
        if (token == address(0)) {
            // MATIC deposit
            vault.depositMATIC{value: amount}();
        } else {
            // Token deposit
            vault.depositUSDC(amount);
        }

        emit MetaTransactionExecuted(depositor, amount, token);
    }

    /**
     * @dev Get the hash for meta-transaction signature
     */
    function getMetaTransactionHash(
        address depositor,
        uint256 amount,
        address token,
        uint256 deadline
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(DEPOSIT_TYPEHASH, depositor, amount, token, nonces[depositor], deadline)
        );
        return _hashTypedDataV4(structHash);
    }

    // Allow contract to receive MATIC
    receive() external payable {}
}
