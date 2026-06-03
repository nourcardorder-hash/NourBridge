const { ethers } = require('ethers');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');

class Web3Service {
  constructor() {
    // Initialize providers for different networks
    this.providers = {
      ethereum: new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL),
      polygon: new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL),
      bsc: new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL)
    };

    this.networkConfig = {
      ethereum: { chainId: 1, name: 'Ethereum' },
      polygon: { chainId: 137, name: 'Polygon' },
      bsc: { chainId: 56, name: 'Binance Smart Chain' }
    };
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId) {
    try {
      const newWallet = ethers.Wallet.createRandom();

      // Check if wallet already exists
      let wallet = await Wallet.findOne({ userId });
      
      if (!wallet) {
        wallet = new Wallet({
          userId,
          walletAddress: newWallet.address,
          privateKeyEncrypted: this.encryptPrivateKey(newWallet.privateKey),
          supportedNetworks: [
            { networkName: 'Ethereum', chainId: 1, walletAddress: newWallet.address, isActive: true },
            { networkName: 'Polygon', chainId: 137, walletAddress: newWallet.address, isActive: true },
            { networkName: 'BSC', chainId: 56, walletAddress: newWallet.address, isActive: true }
          ]
        });
        await wallet.save();
      }

      return {
        walletAddress: wallet.walletAddress,
        supportedNetworks: wallet.supportedNetworks
      };
    } catch (error) {
      console.error('Wallet creation error:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletAddress, network = 'ethereum', token = null) {
    try {
      const provider = this.providers[network];
      if (!provider) throw new Error(`Unsupported network: ${network}`);

      let balance;
      if (token) {
        // ERC20 token balance
        const erc20ABI = ['function balanceOf(address owner) view returns (uint256)'];
        const contract = new ethers.Contract(token, erc20ABI, provider);
        const rawBalance = await contract.balanceOf(walletAddress);
        balance = ethers.utils.formatEther(rawBalance);
      } else {
        // Native token balance
        const rawBalance = await provider.getBalance(walletAddress);
        balance = ethers.utils.formatEther(rawBalance);
      }

      return parseFloat(balance);
    } catch (error) {
      console.error('Balance retrieval error:', error);
      throw error;
    }
  }

  /**
   * Transfer crypto to wallet
   */
  async transferCrypto(fromPrivateKey, toAddress, amount, network = 'ethereum', token = null) {
    try {
      const provider = this.providers[network];
      const wallet = new ethers.Wallet(fromPrivateKey, provider);

      let tx;
      if (token) {
        // ERC20 transfer
        const erc20ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
        const contract = new ethers.Contract(token, erc20ABI, wallet);
        const amountWei = ethers.utils.parseEther(amount.toString());
        tx = await contract.transfer(toAddress, amountWei);
      } else {
        // Native token transfer
        tx = await wallet.sendTransaction({
          to: toAddress,
          value: ethers.utils.parseEther(amount.toString())
        });
      }

      const receipt = await tx.wait();

      // Record transaction
      const transaction = new Transaction({
        sourceType: 'wallet',
        destinationType: 'wallet',
        destinationAddress: toAddress,
        sourceAmount: amount,
        destinationAmount: amount,
        transactionType: 'crypto-swap',
        blockchainNetwork: network,
        transactionHash: receipt.transactionHash,
        status: 'completed'
      });

      await transaction.save();

      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Crypto transfer error:', error);
      throw error;
    }
  }

  /**
   * Swap tokens using DEX (e.g., Uniswap)
   */
  async swapTokens(fromToken, toToken, amount, network = 'ethereum', slippage = 0.5) {
    try {
      // This would integrate with a DEX like Uniswap
      // Implementation depends on specific DEX choice

      console.log(`Swapping ${amount} ${fromToken} to ${toToken} on ${network}`);

      const transaction = new Transaction({
        transactionType: 'crypto-swap',
        sourceType: 'wallet',
        sourceCurrency: fromToken,
        sourceAmount: amount,
        destinationCurrency: toToken,
        blockchainNetwork: network,
        status: 'pending'
      });

      await transaction.save();

      return {
        transactionId: transaction._id,
        status: 'pending'
      };
    } catch (error) {
      console.error('Token swap error:', error);
      throw error;
    }
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(txHash, network = 'ethereum') {
    try {
      const provider = this.providers[network];
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatEther(tx.value),
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
        gasLimit: tx.gasLimit.toString(),
        gasUsed: receipt ? receipt.gasUsed.toString() : null,
        status: receipt ? (receipt.status ? 'success' : 'failed') : 'pending',
        blockNumber: receipt ? receipt.blockNumber : null
      };
    } catch (error) {
      console.error('Transaction details retrieval error:', error);
      throw error;
    }
  }

  /**
   * Estimate gas fees for transaction
   */
  async estimateGasFees(network = 'ethereum') {
    try {
      const provider = this.providers[network];
      const feeData = await provider.getFeeData();

      return {
        gasPrice: ethers.utils.formatUnits(feeData.gasPrice, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null
      };
    } catch (error) {
      console.error('Gas estimation error:', error);
      throw error;
    }
  }

  /**
   * Encrypt private key for storage
   */
  encryptPrivateKey(privateKey) {
    // TODO: Implement proper encryption using a key management service
    // For now, just a placeholder
    return privateKey; // In production, encrypt this!
  }

  /**
   * Decrypt private key for transactions
   */
  decryptPrivateKey(encryptedKey) {
    // TODO: Implement proper decryption
    return encryptedKey; // In production, decrypt this!
  }
}

module.exports = new Web3Service();
