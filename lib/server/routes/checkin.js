const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/notifications');

// POST validate QR + record attendance
router.post('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { ticketData } = req.body;
    if (!ticketData) {
      return res.status(400).json({ success: false, message: 'ticketData required' });
    }

    let parsed;
    try {
      parsed = typeof ticketData === 'string' ? JSON.parse(ticketData) : ticketData;
    } catch {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid ticket — not a JSON QR code' });
    }

    const { userId, expoId, timestamp } = parsed;
    if (!userId || !expoId) {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid ticket — missing user or expo' });
    }

    const [user, expo] = await Promise.all([
      User.findById(userId).select('name email role avatar company'),
      Expo.findById(expoId).select('title startDate endDate organizer'),
    ]);
    if (!user) return res.status(404).json({ success: false, valid: false, message: 'Ticket holder not found' });
    if (!expo) return res.status(404).json({ success: false, valid: false, message: 'Expo not found' });

    // Authorization: organizer can only check in for their own expos (admin always allowed)
    if (req.user.role !== 'admin' && expo.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, valid: false, message: 'Not authorized to check in for this expo' });
    }

    const existing = await Attendance.findOne({ user: userId, expo: expoId });
    if (existing) {
      return res.json({
        success: true,
        valid: true,
        alreadyCheckedIn: true,
        user,
        expo,
        checkedInAt: existing.createdAt,
        message: `${user.name} was already checked in at ${new Date(existing.createdAt).toLocaleTimeString()}`,
      });
    }

    const attendance = await Attendance.create({
      user: userId,
      expo: expoId,
      scannedBy: req.user._id,
      ticketIssuedAt: timestamp ? new Date(timestamp) : undefined,
    });

    await logActivity({ user: req.user._id, action: 'Attendee Checked In', entity: 'Attendance', entityId: attendance._id, details: `${user.name} → ${expo.title}`, req });

    res.json({
      success: true,
      valid: true,
      alreadyCheckedIn: false,
      user,
      expo,
      checkedInAt: attendance.createdAt,
      message: `Checked in ${user.name}`,
    });
  } catch (err) {
    res.fail(err);
  }
});

// GET attendance list for an expo (organizer/admin)
router.get('/expo/:expoId', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.expoId).select('organizer');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (req.user.role !== 'admin' && expo.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const list = await Attendance.find({ expo: req.params.expoId })
      .populate('user', 'name email role avatar company')
      .populate('scannedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;
