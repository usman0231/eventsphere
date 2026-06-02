const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// GET my notifications
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.fail(err);
  }
});

// PUT mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.fail(err);
  }
});

// PUT mark single as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    notification.isRead = true;
    await notification.save();
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.fail(err);
  }
});

// DELETE single notification
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await notification.deleteOne();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.fail(err);
  }
});

// POST admin announcement (broadcast to all users or a role)
router.post('/announce', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, message, role, link } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message required' });
    }
    const userQuery = role && role !== 'all' ? { role } : {};
    const users = await User.find(userQuery).select('_id');

    const io = req.app.get('io');
    for (const u of users) {
      if (u._id.toString() === req.user._id.toString()) continue;
      await createNotification(io, {
        recipient: u._id,
        sender: req.user._id,
        type: 'announcement',
        title: `📣 ${title}`,
        message,
        link: link || null
      });
    }

    res.json({ success: true, sent: users.length, message: 'Announcement broadcast' });
  } catch (err) {
    res.fail(err);
  }
});

// DELETE all notifications
router.delete('/', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;