const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  eventType: {
    type: String,
    enum: [
      'wallet_created',
      'deposit_received',
      'withdrawal_sent',
      'swap_completed',
      'transaction_pending',
      'transaction_confirmed',
      'transaction_failed',
      'kyc_submitted',
      'kyc_verified',
      'bank_account_added',
      'bank_account_verified',
      'payment_received',
      'payout_sent',
      'security_alert',
      'login_detected',
      'device_added',
      'settings_changed'
    ],
    required: true
  },
  
  category: {
    type: String,
    enum: ['transaction', 'security', 'account', 'payment', 'verification'],
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  description: String,
  
  // Related transaction or resource
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedType: String,
  
  // Event metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  // Blockchain info (if applicable)
  blockchainNetwork: String,
  transactionHash: String,
  blockNumber: Number,
  
  // Notification status
  isNotified: { type: Boolean, default: false },
  notifiedAt: Date,
  notificationMethod: String,
  
  // Severity level
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  
  // Read status
  isRead: { type: Boolean, default: false },
  readAt: Date,
  
  // Source
  source: {
    type: String,
    enum: ['blockchain', 'stripe', 'user_action', 'system', 'external'],
    default: 'system'
  },
  
  // Signature verification
  signature: String,
  signatureVerified: { type: Boolean, default: false },
  masterKeyId: String,
  
  // Sandbox/Production flag
  isSandbox: { type: Boolean, default: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
eventSchema.index({ userId: 1, createdAt: -1 });
eventSchema.index({ userId: 1, isRead: 1 });
eventSchema.index({ signature: 1 });
eventSchema.index({ masterKeyId: 1 });

module.exports = mongoose.model('Event', eventSchema);
