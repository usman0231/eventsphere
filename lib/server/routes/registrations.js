const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');
const { signToken } = require('../utils/qrToken');

// POST /api/registrations — register the current user for an expo (idempotent).
// Returns the registration incl. its signed qrToken, which the QR ticket encodes.
router.post('/', protect, async (req, res) => {
  try {
    const { expoId, payment } = req.body;
    if (!expoId) return res.status(400).json({ success: false, message: 'expoId required' });

    const expo = await Expo.findById(expoId).select('title status entryFee');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This expo has been cancelled' });
    }

    // Derive the payment split server-side from the expo's real entry fee so a
    // client can't fake what they owe. amountPaid is clamped to [0, fee].
    const fee = Math.max(0, Number(expo.entryFee) || 0);
    const amountPaid = Math.min(fee, Math.max(0, Number(payment?.amountPaid)) || (fee || 0));
    const paymentInfo = {
      entryFee: fee,
      amountPaid,
      balanceDue: Math.max(0, fee - amountPaid),
      paidInFull: amountPaid >= fee,
      paidAt: new Date(),
    };

    let registration = await Registration.findOne({ user: req.user._id, expo: expoId });
    let created = false;

    if (!registration) {
      // Create first, then sign with the real _id so the token is bound to the
      // registration. Handle the race where two requests create at once.
      try {
        registration = await Registration.create({ user: req.user._id, expo: expoId, payment: paymentInfo });
        created = true;
      } catch (err) {
        if (err.code === 11000) {
          registration = await Registration.findOne({ user: req.user._id, expo: expoId });
        } else {
          throw err;
        }
      }
    }

    let dirty = false;

    // For an existing registration (returning user who just paid again, e.g.
    // topping up a deposit), record this checkout's payment so it reflects the
    // latest payment and shows up in the admin Payments view.
    if (!created) {
      registration.payment = paymentInfo;
      dirty = true;
    }

    if (!registration.qrToken) {
      registration.qrToken = signToken({ rid: registration._id, uid: req.user._id, eid: expoId });
      dirty = true;
    }

    if (dirty) await registration.save();

    res.status(created ? 201 : 200).json({ success: true, created, registration });
  } catch (err) {
    res.fail(err);
  }
});

// GET /api/registrations/payments — admin view of every ticket payment, who
// paid, how much, and what balance is still owed at the venue.
router.get('/payments', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const regs = await Registration.find({ 'payment.entryFee': { $gt: 0 } })
      .populate('user', 'name email role')
      .populate('expo', 'title')
      .sort({ 'payment.paidAt': -1, createdAt: -1 })
      .lean();

    const summary = regs.reduce((acc, r) => {
      acc.collected += r.payment?.amountPaid || 0;
      acc.outstanding += r.payment?.balanceDue || 0;
      return acc;
    }, { collected: 0, outstanding: 0 });
    summary.count = regs.length;

    res.json({ success: true, data: regs, summary });
  } catch (err) {
    res.fail(err);
  }
});

// GET /api/registrations/me?expoId= — the caller's registration for one expo.
router.get('/me', protect, async (req, res) => {
  try {
    const { expoId } = req.query;
    if (!expoId) return res.status(400).json({ success: false, message: 'expoId required' });
    const registration = await Registration.findOne({ user: req.user._id, expo: expoId });
    if (!registration) return res.status(404).json({ success: false, message: 'Not registered' });
    res.json({ success: true, registration });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;
