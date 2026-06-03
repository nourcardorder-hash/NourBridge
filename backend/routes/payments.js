const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/payments/create-intent
 * Create a Stripe payment intent for fiat deposits
 */
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const result = await PaymentService.createPaymentIntent(
      req.user.id,
      amount,
      currency || 'usd',
      metadata
    );

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/payments/confirm
 * Confirm a payment and process conversion
 */
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId, destinationWalletAddress } = req.body;

    if (!paymentIntentId || !destinationWalletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const transaction = await PaymentService.confirmPayment(
      paymentIntentId,
      destinationWalletAddress
    );

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/payments/payout
 * Create a payout for crypto-to-fiat conversion
 */
router.post('/payout', authenticate, async (req, res) => {
  try {
    const { amount, currency, bankAccountId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const result = await PaymentService.createPayout(
      req.user.id,
      amount,
      currency || 'usd',
      bankAccountId
    );

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/payments/transaction/:id
 * Get transaction details
 */
router.get('/transaction/:id', authenticate, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Verify user owns this transaction
    if (transaction.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Transaction retrieval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/payments/transactions
 * Get user's transaction history
 */
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { status, transactionType, limit = 20, skip = 0 } = req.query;

    const filter = { userId: req.user.id };
    if (status) filter.status = status;
    if (transactionType) filter.transactionType = transactionType;

    const transactions = await Transaction.find(filter)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Transactions retrieval error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook handler
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = JSON.parse(req.body);

    // Verify webhook signature in production
    // const event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);

    await PaymentService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
