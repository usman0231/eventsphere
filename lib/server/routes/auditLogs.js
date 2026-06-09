const express = require('express');
const router = express.Router();
const CheckInAudit = require('../models/CheckInAudit');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');

// GET /api/audit-logs?event=&page=&limit= — check-in management audit trail.
// Admins see everything; organizers see only logs for expos they own.
router.get('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { event } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const filter = {};
    if (req.user.role !== 'admin') {
      const owned = await Expo.find({ organizer: req.user._id }).select('_id');
      const ownedIds = owned.map((e) => e._id);
      if (event) {
        if (!ownedIds.some((id) => id.toString() === event)) {
          return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
        }
        filter.event = event;
      } else {
        filter.event = { $in: ownedIds };
      }
    } else if (event) {
      filter.event = event;
    }

    const total = await CheckInAudit.countDocuments(filter);
    const data = await CheckInAudit.find(filter)
      .populate('event', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data, total, page, limit });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;
