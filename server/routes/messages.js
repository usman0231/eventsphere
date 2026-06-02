const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

router.get('/inbox', protect, async (req, res) => {
  try {
    const messages = await Message.find({ recipient: req.user._id })
      .populate('sender', 'name avatar role company')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/sent', protect, async (req, res) => {
  try {
    const messages = await Message.find({ sender: req.user._id })
      .populate('recipient', 'name avatar role company')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const message = await Message.create({ ...req.body, sender: req.user._id });

    const io = req.app.get('io');
    const preview = (message.content || '').slice(0, 90);
    await createNotification(io, {
      recipient: message.recipient,
      sender: req.user._id,
      type: 'message',
      title: `✉️ New message from ${req.user.name}`,
      message: message.subject ? `${message.subject} — ${preview}` : preview,
      link: '/messages'
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id/read', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    message.isRead = true;
    await message.save();
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    const uid = req.user._id.toString();
    if (message.recipient.toString() !== uid && message.sender.toString() !== uid) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await message.deleteOne();
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;