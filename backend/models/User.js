const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /.+\@.+\..+/
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  firstName: String,
  lastName: String,
  phoneNumber: String,
  
  // KYC/AML Information
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  kycDocuments: [{
    type: String,
    url: String,
    uploadedAt: Date
  }],
  amlVerified: Boolean,
  
  // Wallet Information
  walletAddress: String,
  walletType: {
    type: String,
    enum: ['metamask', 'walletconnect', 'custodial'],
    default: 'custodial'
  },
  
  // Bank Account Information
  bankAccounts: [{
    accountNumber: String,
    routingNumber: String,
    bankName: String,
    accountHolder: String,
    accountType: String,
    verified: Boolean,
    verifiedAt: Date
  }],
  
  // Transaction Limits
  dailyLimit: { type: Number, default: 10000 },
  monthlyLimit: { type: Number, default: 100000 },
  currentDailyUsage: { type: Number, default: 0 },
  currentMonthlyUsage: { type: Number, default: 0 },
  
  // Account Status
  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspensionReason: String,
  
  // Two-Factor Authentication
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: Date
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Exclude password from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
