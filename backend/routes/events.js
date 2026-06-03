const express = require('express');
const router = express.Router();
const EventSyncService = require('../services/EventSyncService');
const Event = require('../models/Event');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/events
 * Get user events with filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      eventType,
      category,
      isRead,
      limit = 20,
      skip = 0,
      startDate,
      endDate,
      sandbox
    } = req.query;

    const result = await EventSyncService.getUserEvents(req.user.id, {
      eventType,
      category,
      isRead: isRead ? isRead === 'true' : undefined,
      limit,
      skip,
      startDate,
      endDate,
      sandbox: sandbox !== undefined ? sandbox === 'true' : null
    });

    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination,
      sandboxMode: EventSyncService.isSandboxEnabled()
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/events/unread/count
 * Get unread events count
 */
router.get('/unread/count', authenticate, async (req, res) => {
  try {
    const { sandbox } = req.query;
    const count = await EventSyncService.getUnreadCount(
      req.user.id,
      sandbox !== undefined ? sandbox === 'true' : null
    );

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/events/mark-as-read
 * Mark events as read
 */
router.post('/mark-as-read', authenticate, async (req, res) => {
  try {
    const { eventIds } = req.body;

    if (!eventIds || !Array.isArray(eventIds)) {
      return res.status(400).json({
        success: false,
        message: 'eventIds must be an array'
      });
    }

    const result = await EventSyncService.markEventsAsRead(req.user.id, eventIds);

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/events/:id
 * Get single event details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('relatedId');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Verify user owns this event
    if (event.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Mark as read
    if (!event.isRead) {
      event.isRead = true;
      event.readAt = new Date();
      await event.save();
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/events/sync
 * Sync event from external source (requires master key signature)
 * Works in both development and production
 */
router.post('/sync', async (req, res) => {
  try {
    const { eventData, signature, masterKeyId } = req.body;

    if (!eventData || !signature || !masterKeyId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventData, signature, masterKeyId'
      });
    }

    // Verify signature
    if (!EventSyncService.verifySignature(eventData, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature - Event rejected'
      });
    }

    const event = await EventSyncService.syncEvent(eventData, signature, masterKeyId);

    res.status(201).json({
      success: true,
      data: event,
      message: 'Event synced successfully',
      sandboxMode: EventSyncService.isSandboxEnabled()
    });
  } catch (error) {
    console.error('Event sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/events/sandbox
 * Create local sandbox event (works in production when enabled)
 */
router.post('/sandbox', authenticate, async (req, res) => {
  try {
    if (!EventSyncService.isSandboxEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Sandbox mode is disabled. Enable SANDBOX_MODE=true in environment variables.'
      });
    }

    const { eventType, category, title, description, metadata, severity } = req.body;

    if (!eventType || !category || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventType, category, title'
      });
    }

    const event = await EventSyncService.createSandboxEvent(req.user.id, {
      eventType,
      category,
      title,
      description,
      metadata,
      severity
    });

    res.status(201).json({
      success: true,
      data: event,
      message: 'Sandbox event created'
    });
  } catch (error) {
    console.error('Create sandbox event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/events/stats/system
 * Get system event statistics
 */
router.get('/stats/system', authenticate, async (req, res) => {
  try {
    const stats = await EventSyncService.getSystemStats(req.user.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * DELETE /api/events/:id
 * Delete event
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Verify user owns this event
    if (event.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/events/verify-signature
 * Verify event signature (utility endpoint)
 */
router.post('/verify-signature', (req, res) => {
  try {
    const { eventData, signature } = req.body;

    if (!eventData || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing eventData or signature'
      });
    }

    const isValid = EventSyncService.verifySignature(eventData, signature);

    res.json({
      success: true,
      data: { isValid }
    });
  } catch (error) {
    console.error('Verify signature error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/events/create-signature
 * Create signature for event (utility endpoint)
 */
router.post('/create-signature', (req, res) => {
  try {
    const { eventData } = req.body;

    if (!eventData) {
      return res.status(400).json({
        success: false,
        message: 'Missing eventData'
      });
    }

    const signature = EventSyncService.createSignature(eventData);

    res.json({
      success: true,
      data: { signature }
    });
  } catch (error) {
    console.error('Create signature error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
