const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Attendance = require('../models/Attendance');
const CheckInLog = require('../models/CheckInLog');
const CheckInAudit = require('../models/CheckInAudit');
const User = require('../models/User');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/notifications');
const { verifyToken } = require('../utils/qrToken');

// Fire-and-forget audit log of a check-in attempt (success or failure).
const audit = (req, fields) =>
  CheckInLog.create({ scannedBy: req.user?._id, ip: req.ip, ...fields }).catch(() => {});

// Build the list of expo IDs an organizer owns (admins are unrestricted → null).
async function ownedExpoIds(req) {
  if (req.user.role === 'admin') return null;
  const expos = await Expo.find({ organizer: req.user._id }).select('_id');
  return expos.map((e) => e._id);
}

// POST /api/checkin — validate a signed QR ticket and record attendance.
router.post('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { ticketData } = req.body;
    if (!ticketData) return res.status(400).json({ success: false, message: 'ticketData required' });

    // 1. Parse the QR payload. Only the signed v2 format is accepted.
    let parsed;
    try {
      parsed = typeof ticketData === 'string' ? JSON.parse(ticketData) : ticketData;
    } catch {
      await audit(req, { result: 'invalid', message: 'Not a JSON QR code' });
      return res.status(400).json({ success: false, valid: false, message: 'Invalid ticket — not a recognised QR code' });
    }
    if (!parsed || parsed.v !== 2 || !parsed.t) {
      await audit(req, { result: 'invalid', message: 'Outdated/unsigned QR' });
      return res.status(400).json({ success: false, valid: false, message: 'Outdated ticket — please re-open your ticket to get an updated QR code' });
    }

    // 2. Verify the signature.
    const payload = verifyToken(parsed.t);
    if (!payload) {
      await audit(req, { result: 'forged', message: 'Bad signature' });
      return res.status(400).json({ success: false, valid: false, message: 'Invalid ticket — signature could not be verified' });
    }

    // 3. Find the registration and make sure the token still matches it.
    const registration = await Registration.findById(payload.rid);
    if (!registration || registration.qrToken !== parsed.t) {
      await audit(req, { result: 'not_registered', user: payload.uid, expo: payload.eid, message: 'No matching registration' });
      return res.status(404).json({ success: false, valid: false, message: 'Ticket holder is not registered for this event' });
    }
    if (registration.expo.toString() !== String(payload.eid)) {
      await audit(req, { result: 'wrong_event', registration: registration._id, user: registration.user, message: 'Token/expo mismatch' });
      return res.status(400).json({ success: false, valid: false, message: 'This ticket is for a different event' });
    }

    const [user, expo] = await Promise.all([
      User.findById(registration.user).select('name email role avatar company'),
      Expo.findById(registration.expo).select('title startDate endDate organizer status'),
    ]);
    if (!user) {
      await audit(req, { result: 'not_registered', registration: registration._id, expo: registration.expo, message: 'Ticket holder not found' });
      return res.status(404).json({ success: false, valid: false, message: 'Ticket holder not found' });
    }
    if (!expo) {
      await audit(req, { result: 'invalid', registration: registration._id, user: user._id, message: 'Expo not found' });
      return res.status(404).json({ success: false, valid: false, message: 'Expo not found' });
    }

    // 4. Reject only events the organizer has marked finished or cancelled. The
    //    status (which the organizer controls and the UI displays) is the source
    //    of truth — not the raw endDate, which can lag behind a still-"ongoing"
    //    expo and wrongly flag a live event as expired.
    if (expo.status === 'cancelled' || expo.status === 'completed') {
      const why = expo.status === 'cancelled' ? 'cancelled' : 'over';
      await audit(req, { result: 'expired', registration: registration._id, user: user._id, expo: expo._id, message: `Expo ${why}` });
      return res.status(400).json({ success: false, valid: false, message: `Ticket expired — "${expo.title}" is ${why}` });
    }

    // 5. Organizers may only check in for their own expos (admins always allowed).
    if (req.user.role !== 'admin' && expo.organizer.toString() !== req.user._id.toString()) {
      await audit(req, { result: 'unauthorized', registration: registration._id, user: user._id, expo: expo._id, message: 'Not organizer of this expo' });
      return res.status(403).json({ success: false, valid: false, message: 'Not authorized to check in for this expo' });
    }

    // 6. Already checked in → no duplicate record.
    if (registration.checkInStatus) {
      await audit(req, { result: 'already_checked_in', registration: registration._id, user: user._id, expo: expo._id });
      return res.json({
        success: true, valid: true, alreadyCheckedIn: true, user, expo,
        checkedInAt: registration.checkInTime,
        message: `${user.name} was already checked in at ${new Date(registration.checkInTime).toLocaleTimeString()}`,
      });
    }

    // 7. First check-in — flip status, write the analytics Attendance record, log, emit.
    registration.checkInStatus = true;
    registration.checkInTime = new Date();
    registration.scannedBy = req.user._id;
    await registration.save();

    // Keep the existing Attendance collection populated so analytics keep working.
    await Attendance.create({ user: user._id, expo: expo._id, scannedBy: req.user._id, ticketIssuedAt: registration.ticketIssuedAt })
      .catch((err) => { if (err.code !== 11000) console.error('Attendance write failed:', err.message); });

    await audit(req, { result: 'success', registration: registration._id, user: user._id, expo: expo._id });
    await logActivity({ user: req.user._id, action: 'Attendee Checked In', entity: 'Registration', entityId: registration._id, details: `${user.name} → ${expo.title}`, req });

    const payloadOut = {
      registrationId: registration._id,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, company: user.company, avatar: user.avatar },
      expo: { _id: expo._id, title: expo.title },
      checkInTime: registration.checkInTime,
    };
    req.app.get('io')?.to('checkin').emit('checkin:new', payloadOut);
    req.app.get('io')?.to(`expo:${expo._id}`).emit('checkin:new', payloadOut);

    res.json({
      success: true, valid: true, alreadyCheckedIn: false, user, expo,
      checkedInAt: registration.checkInTime,
      message: `Checked in ${user.name}`,
    });
  } catch (err) {
    res.fail(err);
  }
});

// POST /api/checkin/:id/undo — reverse an accidental check-in.
//   Body: { reason? }. Admins may undo any; organizers only for their own expos.
router.post('/:id/undo', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { reason } = req.body;

    const registration = await Registration.findById(req.params.id).populate('user', 'name email');
    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });
    if (!registration.checkInStatus) {
      return res.status(400).json({ success: false, message: 'This attendee is not currently checked in' });
    }

    // The expo may have been deleted, leaving this registration orphaned. If it
    // still exists, enforce organizer ownership; if it's gone, allow the undo so
    // the stale check-in can be cleared.
    const expo = await Expo.findById(registration.expo).select('organizer title');
    if (expo && req.user.role !== 'admin' && expo.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to undo check-ins for this expo' });
    }

    // Reverse the check-in on the registration…
    registration.checkInStatus = false;
    registration.checkInTime = null;
    registration.scannedBy = null;
    await registration.save();

    // …and drop the analytics Attendance record so stats reflect reality.
    await Attendance.findOneAndDelete({ user: registration.user._id, expo: registration.expo }).catch(() => {});

    // Record the action in the audit trail (names denormalised).
    await CheckInAudit.create({
      admin: req.user._id,
      adminName: req.user.name,
      attendee: registration.user._id,
      attendeeName: registration.user.name,
      event: expo?._id || registration.expo,
      registration: registration._id,
      action: 'UNDO_CHECK_IN',
      reason: (reason || '').trim(),
      ip: req.ip,
    });

    await logActivity({ user: req.user._id, action: 'Check-In Undone', entity: 'Registration', entityId: registration._id, details: `${registration.user.name} → ${expo?.title || 'deleted expo'}${reason ? ` (${reason})` : ''}`, req });

    req.app.get('io')?.to('checkin').emit('checkin:undo', { registrationId: registration._id });

    res.json({ success: true, message: `Check-in undone for ${registration.user.name}`, registration });
  } catch (err) {
    res.fail(err);
  }
});

// GET /api/checkin/registrations — list registrations with search & filters.
//   ?expo=<id>  &status=checkedin|pending|all  &q=<name/email>  &page= &limit=
router.get('/registrations', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { expo, status = 'all', q = '' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const filter = {};
    const owned = await ownedExpoIds(req);
    if (expo) {
      if (owned && !owned.some((id) => id.toString() === expo)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
      }
      filter.expo = expo;
    } else if (owned) {
      filter.expo = { $in: owned };
    }
    if (status === 'checkedin') filter.checkInStatus = true;
    else if (status === 'pending') filter.checkInStatus = false;

    // Search by attendee name/email → resolve to user ids first.
    if (q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id');
      filter.user = { $in: users.map((u) => u._id) };
    }

    const total = await Registration.countDocuments(filter);
    const data = await Registration.find(filter)
      .populate('user', 'name email role company')
      .populate('expo', 'title')
      .sort({ checkInStatus: -1, checkInTime: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data, total, page, limit });
  } catch (err) {
    res.fail(err);
  }
});

// GET /api/checkin/stats?expo= — registration/attendance summary numbers.
router.get('/stats', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { expo } = req.query;
    const filter = {};
    const owned = await ownedExpoIds(req);
    if (expo) {
      if (owned && !owned.some((id) => id.toString() === expo)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
      }
      filter.expo = expo;
    } else if (owned) {
      filter.expo = { $in: owned };
    }

    const [totalRegistered, totalCheckedIn] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.countDocuments({ ...filter, checkInStatus: true }),
    ]);
    const remaining = totalRegistered - totalCheckedIn;
    const attendancePct = totalRegistered ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

    res.json({ success: true, data: { totalRegistered, totalCheckedIn, remaining, attendancePct } });
  } catch (err) {
    res.fail(err);
  }
});

// GET /api/checkin/expo/:expoId — attendance list for an expo (kept for compatibility).
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
