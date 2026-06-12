const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search, action, status, entity, since } = req.query;
    const query = {};
    // Organizers only ever see their own activity; admins see everything.
    if (req.user.role === 'organizer') query.user = req.user._id;
    if (action) query.action = { $regex: action, $options: 'i' };
    if (status) query.status = status;
    if (entity) query.entity = entity;
    if (since) query.createdAt = { $gte: new Date(since) };
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
      ];
    }

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await ActivityLog.countDocuments(query);
    res.json({ success: true, data: logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, last24h, byStatus, topActions] = await Promise.all([
      ActivityLog.countDocuments(),
      ActivityLog.countDocuments({ createdAt: { $gte: since24h } }),
      ActivityLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ActivityLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);
    res.json({ success: true, data: { total, last24h, byStatus, topActions } });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;