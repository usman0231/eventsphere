const express = require('express');
const router = express.Router();
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');

const SIZES = ['small', 'medium', 'large', 'extra-large'];

// Admins manage any expo; organizers only the expo they own.
async function canManageExpo(user, expoId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'organizer') return false;
  const expo = await Expo.findById(expoId).select('organizer');
  return !!expo && expo.organizer.toString() === user._id.toString();
}

// Add booths to an expo (auto-numbered continuing from the highest existing Bxxx).
router.post('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { expo, size = 'medium', price = 0 } = req.body;
    const count = parseInt(req.body.count, 10);
    if (!expo) return res.status(422).json({ success: false, message: 'expo is required' });
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return res.status(422).json({ success: false, message: 'count must be between 1 and 100' });
    }
    if (!SIZES.includes(size)) return res.status(422).json({ success: false, message: 'Invalid booth size' });
    if (!(await canManageExpo(req.user, expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }

    // Continue numbering from the current highest booth number (B007 → B008, …).
    const existing = await Booth.find({ expo }).select('boothNumber');
    let maxNum = 0;
    for (const b of existing) {
      const m = /(\d+)/.exec(b.boothNumber || '');
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    const docs = [];
    for (let i = 1; i <= count; i++) {
      docs.push({ expo, boothNumber: `B${String(maxNum + i).padStart(3, '0')}`, size, price: Number(price) || 0 });
    }
    const created = await Booth.insertMany(docs);
    res.status(201).json({ success: true, data: created, message: `Added ${created.length} booth(s)` });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A booth number collision occurred — try again' });
    res.fail(err);
  }
});

router.get('/expo/:expoId', async (req, res) => {
  try {
    const booths = await Booth.find({ expo: req.params.expoId })
      .populate('exhibitor', 'name company avatar')
      .sort({ boothNumber: 1 });
    res.json({ success: true, data: booths });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booth = await Booth.findById(req.params.id)
      .populate('exhibitor', 'name company avatar bio')
      .populate('expo', 'title');
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });
    res.json({ success: true, data: booth });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/:id/reserve', protect, authorize('exhibitor', 'admin', 'organizer'), async (req, res) => {
  try {
    // Look up which expo this booth belongs to (for the per-expo dedupe check)
    const target = await Booth.findById(req.params.id).select('expo status');
    if (!target) return res.status(404).json({ success: false, message: 'Booth not found' });
    if (target.status !== 'available') {
      return res.status(400).json({ success: false, message: 'Booth is not available' });
    }

    // One booth per exhibitor per expo (admins/organizers may reserve on behalf of others, skip this check)
    if (req.user.role === 'exhibitor') {
      const existing = await Booth.findOne({
        expo: target.expo,
        exhibitor: req.user._id,
        status: { $in: ['reserved', 'occupied'] },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `You already hold booth ${existing.boothNumber} in this expo. Release it before reserving another.`,
        });
      }
    }

    // Atomic claim: only succeeds if the booth is still 'available'. Prevents the race
    // where two concurrent requests both pass the earlier status check.
    const booth = await Booth.findOneAndUpdate(
      { _id: req.params.id, status: 'available' },
      {
        status: 'reserved',
        exhibitor: req.user._id,
        description: req.body.description,
        products: req.body.products,
      },
      { new: true }
    );
    if (!booth) {
      return res.status(409).json({ success: false, message: 'Booth was just reserved by someone else' });
    }

    res.json({ success: true, data: booth, message: 'Booth reserved successfully' });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const booth = await Booth.findById(req.params.id);
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });

    const isAdmin = req.user.role === 'admin';
    const isExhibitorOwner = req.user.role === 'exhibitor'
      && booth.exhibitor && booth.exhibitor.toString() === req.user._id.toString();
    let isExpoOrganizer = false;
    if (req.user.role === 'organizer') {
      const expo = await Expo.findById(booth.expo).select('organizer');
      isExpoOrganizer = expo && expo.organizer.toString() === req.user._id.toString();
    }

    if (!isAdmin && !isExpoOrganizer && !isExhibitorOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this booth' });
    }

    // Exhibitor may only edit their booth's showcase content, not pricing/status/location/etc.
    const EXHIBITOR_EDITABLE = ['description', 'products', 'staffCount', 'amenities'];
    const updates = isExhibitorOwner && !isAdmin && !isExpoOrganizer
      ? Object.fromEntries(Object.entries(req.body).filter(([k]) => EXHIBITOR_EDITABLE.includes(k)))
      : req.body;

    Object.assign(booth, updates);
    await booth.save();
    res.json({ success: true, data: booth });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:id/release', protect, async (req, res) => {
  try {
    const booth = await Booth.findById(req.params.id);
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });

    const isAdmin = req.user.role === 'admin';
    const isExhibitorOwner = booth.exhibitor && booth.exhibitor.toString() === req.user._id.toString();
    let isExpoOrganizer = false;
    if (req.user.role === 'organizer') {
      const expo = await Expo.findById(booth.expo).select('organizer');
      isExpoOrganizer = expo && expo.organizer.toString() === req.user._id.toString();
    }
    if (!isAdmin && !isExhibitorOwner && !isExpoOrganizer) {
      return res.status(403).json({ success: false, message: 'Not authorized to release this booth' });
    }

    booth.status = 'available';
    booth.exhibitor = null;
    booth.description = '';
    booth.products = [];
    await booth.save();
    res.json({ success: true, message: 'Booth released successfully' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;