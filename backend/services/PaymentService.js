const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction');
const User = require('../models/User');

class PaymentService {
  /**
   * Create a Stripe payment intent for fiat deposits
   */
  async createPaymentIntent(userId, amount, currency = 'usd', metadata = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe requires cents
        currency: currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          userId: userId.toString(),
          ...metadata
        },
        receipt_email: user.email
      });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        transactionType: 'fiat-to-crypto',
        status: 'pending',
        sourceType: 'card',
        sourceAmount: amount,
        sourceCurrency: currency.toUpperCase(),
        stripePaymentId: paymentIntent.id,
        description: `Deposit ${amount} ${currency.toUpperCase()}`
      });

      await transaction.save();

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        transactionId: transaction._id
      };
    } catch (error) {
      console.error('Payment intent creation error:', error);
      throw error;
    }
  }

  /**
   * Confirm payment and process fiat-to-crypto conversion
   */
  async confirmPayment(paymentIntentId, destinationWalletAddress) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not successful. Status: ${paymentIntent.status}`);
      }

      // Update transaction
      const transaction = await Transaction.findOneAndUpdate(
        { stripePaymentId: paymentIntentId },
        {
          status: 'processing',
          destinationAddress: destinationWalletAddress,
          destinationType: 'wallet'
        },
        { new: true }
      );

      return transaction;
    } catch (error) {
      console.error('Payment confirmation error:', error);
      throw error;
    }
  }

  /**
   * Create payout for crypto-to-fiat conversion
   */
  async createPayout(userId, amount, currency = 'usd', bankAccountId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Get or create Stripe connected account
      const connectedAccountId = await this.getOrCreateConnectedAccount(user);

      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        destination: connectedAccountId
      });

      // Create transaction record
      const transaction = new Transaction({
        userId,
        transactionType: 'crypto-to-fiat',
        status: 'processing',
        sourceType: 'wallet',
        sourceAmount: amount,
        sourceCurrency: 'CRYPTO',
        destinationType: 'bank-account',
        destinationAmount: amount,
        destinationCurrency: currency.toUpperCase(),
        stripeTransferId: transfer.id
      });

      await transaction.save();

      return {
        transferId: transfer.id,
        transactionId: transaction._id,
        status: transfer.status
      };
    } catch (error) {
      console.error('Payout creation error:', error);
      throw error;
    }
  }

  /**
   * Get or create Stripe connected account for a user
   */
  async getOrCreateConnectedAccount(user) {
    try {
      // Check if user already has a connected account
      if (user.stripeConnectId) {
        return user.stripeConnectId;
      }

      // Create new connected account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        individual: {
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          phone: user.phoneNumber
        }
      });

      // Save to user
      user.stripeConnectId = account.id;
      await user.save();

      return account.id;
    } catch (error) {
      console.error('Connected account creation error:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'transfer.paid':
          await this.handleTransferPaid(event.data.object);
          break;
        case 'transfer.failed':
          await this.handleTransferFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    const transaction = await Transaction.findOneAndUpdate(
      { stripePaymentId: paymentIntent.id },
      { status: 'completed' },
      { new: true }
    );
    console.log('Payment successful:', transaction);
  }

  async handlePaymentFailure(paymentIntent) {
    const transaction = await Transaction.findOneAndUpdate(
      { stripePaymentId: paymentIntent.id },
      { 
        status: 'failed',
        errorMessage: paymentIntent.last_payment_error?.message
      },
      { new: true }
    );
    console.log('Payment failed:', transaction);
  }

  async handleTransferPaid(transfer) {
    const transaction = await Transaction.findOneAndUpdate(
      { stripeTransferId: transfer.id },
      { status: 'completed' },
      { new: true }
    );
    console.log('Transfer paid:', transaction);
  }

  async handleTransferFailed(transfer) {
    const transaction = await Transaction.findOneAndUpdate(
      { stripeTransferId: transfer.id },
      { 
        status: 'failed',
        errorMessage: transfer.failure_message
      },
      { new: true }
    );
    console.log('Transfer failed:', transaction);
  }
}

module.exports = new PaymentService();
