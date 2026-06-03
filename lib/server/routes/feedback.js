const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
  try {
    const feedback = await Feedback.create({ ...req.body, user: req.user._id });
    res.status(201).json({ success: true, data: feedback, message: 'Feedback submitted successfully' });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'organizer') {
      const myExpos = await Expo.find({ organizer: req.user._id }).select('_id');
      query.expo = { $in: myExpos.map(e => e._id) };
    }
    const feedbacks = await Feedback.find(query)
      .populate('user', 'name email')
      .populate('expo', 'title')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: feedbacks });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id).populate('expo', 'organizer');
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
    if (req.user.role !== 'admin' && feedback.expo?.organizer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this feedback' });
    }
    Object.assign(feedback, req.body);
    await feedback.save();
    res.json({ success: true, data: feedback });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;