const express = require('express');
const router = express.Router();
const Sponsor = require('../models/Sponsor');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSponsorRules, updateSponsorRules } = require('../validators/sponsor');

// Admins manage any expo; organizers only the expo they own. (Same rule as sessions.)
async function canManageExpo(user, expoId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'organizer') return false;
  const expo = await Expo.findById(expoId).select('organizer');
  return !!expo && expo.organizer.toString() === user._id.toString();
}

// Public — sponsor strip on the expo detail page.
router.get('/expo/:expoId', async (req, res) => {
  try {
    const sponsors = await Sponsor.find({ expo: req.params.expoId }).sort({ tier: 1, order: 1, name: 1 });
    res.json({ success: true, data: sponsors });
  } catch (err) { res.fail(err); }
});

router.post('/', protect, authorize('admin', 'organizer'), createSponsorRules, validate, async (req, res) => {
  try {
    if (!(await canManageExpo(req.user, req.body.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    const sponsor = await Sponsor.create(req.body);
    res.status(201).json({ success: true, data: sponsor });
  } catch (err) { res.fail(err); }
});

router.put('/:id', protect, authorize('admin', 'organizer'), updateSponsorRules, validate, async (req, res) => {
  try {
    const existing = await Sponsor.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Sponsor not found' });
    if (!(await canManageExpo(req.user, existing.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    // expo is immutable — a sponsor can't be moved between expos.
    const { expo, ...updates } = req.body;
    Object.assign(existing, updates);
    await existing.save();
    res.json({ success: true, data: existing });
  } catch (err) { res.fail(err); }
});

router.delete('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const existing = await Sponsor.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Sponsor not found' });
    if (!(await canManageExpo(req.user, existing.expo))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Sponsor removed' });
  } catch (err) { res.fail(err); }
});

module.exports = router;
