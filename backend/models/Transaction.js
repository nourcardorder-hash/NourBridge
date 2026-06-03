const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  transactionType: {
    type: String,
    enum: ['fiat-to-crypto', 'crypto-to-fiat', 'bank-transfer', 'crypto-swap'],
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  // Source Details
  sourceType: {
    type: String,
    enum: ['bank-account', 'wallet', 'card'],
    required: true
  },
  sourceAmount: Number,
  sourceCurrency: String,
  sourceReference: String,
  
  // Destination Details
  destinationType: {
    type: String,
    enum: ['bank-account', 'wallet', 'card'],
    required: true
  },
  destinationAmount: Number,
  destinationCurrency: String,
  destinationAddress: String,
  
  // Exchange Information
  exchangeRate: Number,
  fees: {
    platformFee: Number,
    networkFee: Number,
    bankFee: Number,
    total: Number
  },
  
  // Blockchain Details (if applicable)
  blockchainNetwork: String,
  transactionHash: String,
  blockNumber: Number,
  gasUsed: String,
  
  // Stripe Integration
  stripePaymentId: String,
  stripeTransferId: String,
  
  // Bank Transfer Details
  bankTransferId: String,
  achReferenceNumber: String,
  
  // Error Handling
  errorMessage: String,
  errorCode: String,
  
  // Metadata
  description: String,
  tags: [String],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  
  // Verification
  verifiedBy: mongoose.Schema.Types.ObjectId,
  verificationNotes: String,
  
  // Audit Trail
  auditLog: [{
    action: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  }]
});

// Index for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ transactionHash: 1 });
transactionSchema.index({ stripePaymentId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
