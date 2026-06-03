const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Wallet Address & Balance
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  
  privateKeyEncrypted: String,
  
  // Supported Networks
  supportedNetworks: [{
    networkName: String,
    chainId: Number,
    walletAddress: String,
    isActive: Boolean
  }],
  
  // Balances by Currency
  balances: [{
    currency: String,
    symbol: String,
    amount: Number,
    decimals: Number,
    contractAddress: String,
    lastUpdated: Date
  }],
  
  // Wallet Type
  walletType: {
    type: String,
    enum: ['metamask', 'walletconnect', 'custodial', 'hardware'],
    default: 'custodial'
  },
  
  // Wallet Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verifiedAt: Date,
  
  // Transaction History
  transactionHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  
  // Security
  twoFactorRequired: { type: Boolean, default: true },
  whitelist: [String],
  whitelistEnabled: { type: Boolean, default: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

walletSchema.index({ userId: 1 });
walletSchema.index({ walletAddress: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
