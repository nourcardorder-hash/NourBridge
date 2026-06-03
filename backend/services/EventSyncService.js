const crypto = require('crypto');
const Event = require('../models/Event');
const User = require('../models/User');

class EventSyncService {
  constructor() {
    this.masterKey = process.env.MASTER_KEY;
    this.sandboxEnabled = process.env.SANDBOX_MODE === 'true';
  }

  /**
   * Verify event signature using master key
   */
  verifySignature(eventData, signature) {
    try {
      const payload = typeof eventData === 'string' ? eventData : JSON.stringify(eventData);
      
      // Create HMAC signature
      const hmac = crypto.createHmac('sha256', this.masterKey);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      // Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Create signature for event
   */
  createSignature(eventData) {
    try {
      const payload = typeof eventData === 'string' ? eventData : JSON.stringify(eventData);
      const hmac = crypto.createHmac('sha256', this.masterKey);
      hmac.update(payload);
      return hmac.digest('hex');
    } catch (error) {
      console.error('Signature creation error:', error);
      throw error;
    }
  }

  /**
   * Synchronize event from external source (with signature verification)
   */
  async syncEvent(eventData, signature, masterKeyId) {
    try {
      // Verify signature
      if (!this.verifySignature(eventData, signature)) {
        throw new Error('Invalid event signature');
      }

      const {
        userId,
        eventType,
        category,
        title,
        description,
        relatedId,
        relatedType,
        metadata,
        blockchainNetwork,
        transactionHash,
        blockNumber,
        severity,
        source
      } = eventData;

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create event
      const event = new Event({
        userId,
        eventType,
        category,
        title,
        description,
        relatedId,
        relatedType,
        metadata,
        blockchainNetwork,
        transactionHash,
        blockNumber,
        severity: severity || 'info',
        source: source || 'external',
        signature,
        signatureVerified: true,
        masterKeyId,
        isSandbox: this.sandboxEnabled
      });

      await event.save();

      console.log(`✅ Event synced: ${eventType} for user ${userId}`);

      return event;
    } catch (error) {
      console.error('Event sync error:', error);
      throw error;
    }
  }

  /**
   * Get user events with optional filters
   */
  async getUserEvents(userId, options = {}) {
    try {
      const {
        eventType,
        category,
        isRead,
        limit = 20,
        skip = 0,
        startDate,
        endDate
      } = options;

      const filter = { userId };

      if (eventType) filter.eventType = eventType;
      if (category) filter.category = category;
      if (isRead !== undefined) filter.isRead = isRead;
      if (this.sandboxEnabled) filter.isSandbox = true;

      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const events = await Event.find(filter)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .sort({ createdAt: -1 })
        .populate('relatedId');

      const total = await Event.countDocuments(filter);

      return {
        events,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > skip + limit
        }
      };
    } catch (error) {
      console.error('Get user events error:', error);
      throw error;
    }
  }

  /**
   * Mark events as read
   */
  async markEventsAsRead(userId, eventIds) {
    try {
      const result = await Event.updateMany(
        { _id: { $in: eventIds }, userId },
        { isRead: true, readAt: new Date() }
      );

      return result;
    } catch (error) {
      console.error('Mark events as read error:', error);
      throw error;
    }
  }

  /**
   * Create local sandbox event
   */
  async createSandboxEvent(userId, eventData) {
    try {
      const {
        eventType,
        category,
        title,
        description,
        metadata,
        severity = 'info'
      } = eventData;

      const event = new Event({
        userId,
        eventType,
        category,
        title,
        description,
        metadata,
        severity,
        source: 'system',
        isSandbox: true,
        signature: this.createSignature(eventData),
        signatureVerified: true
      });

      await event.save();

      console.log(`✅ Sandbox event created: ${eventType}`);

      return event;
    } catch (error) {
      console.error('Create sandbox event error:', error);
      throw error;
    }
  }

  /**
   * Sync transaction completion event
   */
  async syncTransactionEvent(transactionId, status) {
    try {
      const Transaction = require('../models/Transaction');
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const eventType = status === 'completed' 
        ? 'transaction_confirmed' 
        : 'transaction_failed';

      const eventData = {
        userId: transaction.userId,
        eventType,
        category: 'transaction',
        title: `Transaction ${status}`,
        description: `Your ${transaction.transactionType} transaction has ${status}`,
        relatedId: transactionId,
        relatedType: 'Transaction',
        metadata: {
          amount: transaction.sourceAmount,
          currency: transaction.sourceCurrency,
          status
        },
        blockchainNetwork: transaction.blockchainNetwork,
        transactionHash: transaction.transactionHash,
        severity: status === 'failed' ? 'warning' : 'info',
        source: 'blockchain'
      };

      const signature = this.createSignature(eventData);

      return await this.syncEvent(eventData, signature, process.env.MASTER_KEY_ID);
    } catch (error) {
      console.error('Sync transaction event error:', error);
      throw error;
    }
  }

  /**
   * Get unread events count
   */
  async getUnreadCount(userId) {
    try {
      const count = await Event.countDocuments({
        userId,
        isRead: false,
        isSandbox: this.sandboxEnabled
      });

      return count;
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  }

  /**
   * Clean old sandbox events (older than 30 days)
   */
  async cleanOldSandboxEvents() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await Event.deleteMany({
        isSandbox: true,
        createdAt: { $lt: thirtyDaysAgo }
      });

      console.log(`🧹 Cleaned ${result.deletedCount} old sandbox events`);

      return result;
    } catch (error) {
      console.error('Clean old events error:', error);
      throw error;
    }
  }
}

module.exports = new EventSyncService();
