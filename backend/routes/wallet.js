const express = require('express');
const router = express.Router();
const Web3Service = require('../services/Web3Service');
const Wallet = require('../models/Wallet');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/wallet/create
 * Create a new wallet for user
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const result = await Web3Service.createWallet(req.user.id);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Wallet creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/wallet
 * Get user's wallet information
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    console.error('Wallet retrieval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/wallet/balance
 * Get wallet balance for specific network
 */
router.get('/balance/:network', authenticate, async (req, res) => {
  try {
    const { network } = req.params;
    const { token } = req.query;

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const balance = await Web3Service.getBalance(
      wallet.walletAddress,
      network,
      token || null
    );

    res.json({
      success: true,
      data: {
        balance,
        network,
        token: token || 'native'
      }
    });
  } catch (error) {
    console.error('Balance retrieval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/wallet/transfer
 * Transfer crypto to another wallet
 */
router.post('/transfer', authenticate, async (req, res) => {
  try {
    const { toAddress, amount, network, token } = req.body;

    if (!toAddress || !amount || !network) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Note: In production, private key should be securely retrieved from KMS
    const result = await Web3Service.transferCrypto(
      wallet.privateKeyEncrypted,
      toAddress,
      amount,
      network,
      token || null
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/wallet/transaction/:hash
 * Get transaction details from blockchain
 */
router.get('/transaction/:hash', authenticate, async (req, res) => {
  try {
    const { hash } = req.params;
    const { network } = req.query;

    if (!network) {
      return res.status(400).json({
        success: false,
        message: 'Network parameter is required'
      });
    }

    const txDetails = await Web3Service.getTransactionDetails(hash, network);

    res.json({
      success: true,
      data: txDetails
    });
  } catch (error) {
    console.error('Transaction details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/wallet/gas-fees
 * Get estimated gas fees for a network
 */
router.get('/gas-fees/:network', async (req, res) => {
  try {
    const { network } = req.params;

    const fees = await Web3Service.estimateGasFees(network);

    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    console.error('Gas fees error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/wallet/whitelist
 * Get wallet whitelist
 */
router.get('/whitelist', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    res.json({
      success: true,
      data: {
        whitelist: wallet.whitelist,
        whitelistEnabled: wallet.whitelistEnabled
      }
    });
  } catch (error) {
    console.error('Whitelist retrieval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/wallet/whitelist
 * Add address to whitelist
 */
router.post('/whitelist', authenticate, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.user.id },
      { $push: { whitelist: address } },
      { new: true }
    );

    res.json({
      success: true,
      data: wallet.whitelist
    });
  } catch (error) {
    console.error('Whitelist update error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
