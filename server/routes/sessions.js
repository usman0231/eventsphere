const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');

async function canManageExpo(user, expoId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'organizer') return false;
  const expo = await Expo.findById(expoId).select('organizer');
  return !!expo && expo.organizer.toString() === user._id.toString();
}

router.get('/expo/:expoId', async (req, res) => {
  try {
    const sessions = await Session.find({ expo: req.params.expoId }).sort({ startTime: 1 });
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.fail(err);
  }
});

// Note: route is intentionally public for session details, but attendee emails are gated.
router.get('/:id', async (req, res) => {
  try {
    // Identify caller if a valid token was sent (route is otherwise public)
    let caller = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
        caller = await require('../models/User').findById(decoded.id).select('role _id');
      } catch { /* invalid token → treat as public */ }
    }

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    let canSeeEmails = false;
    if (caller?.role === 'admin') canSeeEmails = true;
    else if (caller?.role === 'organizer') {
      const expo = await Expo.findById(session.expo).select('organizer');
      canSeeEmails = !!expo && expo.organizer.toString() === caller._id.toString();
    }

    const populated = await Session.findById(req.params.id)
      .populate('registeredAttendees', canSeeEmails ? 'name email avatar' : 'name avatar');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    if (!(await canManageExpo(req.user, req.body.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    const session = await Session.create(req.body);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const existing = await Session.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Session not found' });
    if (!(await canManageExpo(req.user, existing.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    const session = await Session.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: session });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const existing = await Session.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Session not found' });
    if (!(await canManageExpo(req.user, existing.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/:id/register', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.registeredAttendees.includes(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Already registered for this session' });
    }
    if (session.maxAttendees && session.registeredAttendees.length >= session.maxAttendees) {
      return res.status(400).json({ success: false, message: 'Session is full' });
    }
    // Block registration after the parent expo's deadline
    const expo = await Expo.findById(session.expo).select('registrationDeadline title');
    if (expo?.registrationDeadline && new Date() > new Date(expo.registrationDeadline)) {
      return res.status(400).json({ success: false, message: `Registration for "${expo.title}" closed on ${new Date(expo.registrationDeadline).toLocaleDateString()}` });
    }
    session.registeredAttendees.push(req.user._id);
    await session.save();
    res.json({ success: true, message: 'Registered for session successfully' });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:id/register', protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    session.registeredAttendees = session.registeredAttendees.filter(a => a.toString() !== req.user._id.toString());
    await session.save();
    res.json({ success: true, message: 'Unregistered from session' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;