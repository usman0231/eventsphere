const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Expo = require('../models/Expo');
const Attendance = require('../models/Attendance');
const ExhibitorApplication = require('../models/ExhibitorApplication');
const { protect, authorize } = require('../middleware/auth');

// Returns the set of user IDs related to the organizer's expos
// (anyone who checked in or applied as exhibitor to one of their expos).
async function relatedUserIdsForOrganizer(organizerId) {
  const expos = await Expo.find({ organizer: organizerId }).select('_id');
  const expoIds = expos.map(e => e._id);
  if (expoIds.length === 0) return new Set();
  const [attendances, applications] = await Promise.all([
    Attendance.find({ expo: { $in: expoIds } }).select('user'),
    ExhibitorApplication.find({ expo: { $in: expoIds } }).select('user'),
  ]);
  const set = new Set();
  attendances.forEach(a => set.add(a.user.toString()));
  applications.forEach(a => set.add(a.user.toString()));
  return set;
}

router.get('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const attendees = await User.find({ role: 'attendee' }).select('-password').sort({ createdAt: -1 });
      return res.json({ success: true, data: attendees });
    }
    // Organizer: only attendees related to their own expos
    const relatedIds = await relatedUserIdsForOrganizer(req.user._id);
    const attendees = await User.find({ role: 'attendee', _id: { $in: [...relatedIds] } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: attendees });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:userId/expo/:expoId', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.expoId).select('organizer title');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (req.user.role !== 'admin' && expo.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    const removed = await Attendance.findOneAndDelete({ user: req.params.userId, expo: req.params.expoId });
    if (!removed) return res.status(404).json({ success: false, message: 'Attendee not registered for this expo' });
    res.json({ success: true, message: 'Attendee removed from expo' });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user._id.toString() === user._id.toString();
    let canSeeEmail = isAdmin || isSelf;

    if (!canSeeEmail && req.user.role === 'organizer') {
      const relatedIds = await relatedUserIdsForOrganizer(req.user._id);
      canSeeEmail = relatedIds.has(user._id.toString());
    }

    if (!canSeeEmail) delete user.email;
    res.json({ success: true, data: user });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;