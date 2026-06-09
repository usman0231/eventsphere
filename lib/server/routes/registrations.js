const express = require('express');
const router = express.Router();
const Registration = require('../models/Registration');
const Expo = require('../models/Expo');
const { protect } = require('../middleware/auth');
const { signToken } = require('../utils/qrToken');

// POST /api/registrations — register the current user for an expo (idempotent).
// Returns the registration incl. its signed qrToken, which the QR ticket encodes.
router.post('/', protect, async (req, res) => {
  try {
    const { expoId } = req.body;
    if (!expoId) return res.status(400).json({ success: false, message: 'expoId required' });

    const expo = await Expo.findById(expoId).select('title status');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This expo has been cancelled' });
    }

    let registration = await Registration.findOne({ user: req.user._id, expo: expoId });
    let created = false;

    if (!registration) {
      // Create first, then sign with the real _id so the token is bound to the
      // registration. Handle the race where two requests create at once.
      try {
        registration = await Registration.create({ user: req.user._id, expo: expoId });
        created = true;
      } catch (err) {
        if (err.code === 11000) {
          registration = await Registration.findOne({ user: req.user._id, expo: expoId });
        } else {
          throw err;
        }
      }
    }

    if (!registration.qrToken) {
      registration.qrToken = signToken({ rid: registration._id, uid: req.user._id, eid: expoId });
      await registration.save();
    }

    res.status(created ? 201 : 200).json({ success: true, created, registration });
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
