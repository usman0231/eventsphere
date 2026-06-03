const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Expo = require('../models/Expo');
const { protect } = require('../middleware/auth');

// GET reviews for an expo + summary
router.get('/expo/:expoId', async (req, res) => {
  try {
    const expoObjId = new mongoose.Types.ObjectId(req.params.expoId);
    const [reviews, summary] = await Promise.all([
      Review.find({ expo: expoObjId })
        .populate('user', 'name avatar role')
        .sort({ createdAt: -1 })
        .limit(50),
      Review.aggregate([
        { $match: { expo: expoObjId } },
        {
          $group: {
            _id: '$expo',
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
            five: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            four: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            three: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            two: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            one: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          },
        },
      ]),
    ]);
    res.json({
      success: true,
      data: reviews,
      summary: summary[0] || { avg: 0, count: 0, five: 0, four: 0, three: 0, two: 0, one: 0 },
    });
  } catch (err) {
    res.fail(err);
  }
});

// POST a review (or update existing)
router.post('/', protect, async (req, res) => {
  try {
    const { expoId, rating, title, comment } = req.body;
    if (!expoId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Expo and 1–5 rating are required' });
    }
    const expo = await Expo.findById(expoId).select('_id title');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });

    const review = await Review.findOneAndUpdate(
      { user: req.user._id, expo: expoId },
      { rating, title, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('user', 'name avatar role');

    res.status(201).json({ success: true, data: review, message: 'Review submitted' });
  } catch (err) {
    res.fail(err);
  }
});

// DELETE my review for an expo
router.delete('/expo/:expoId', protect, async (req, res) => {
  try {
    await Review.findOneAndDelete({ user: req.user._id, expo: req.params.expoId });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.fail(err);
  }
});

// GET my review for an expo
router.get('/expo/:expoId/me', protect, async (req, res) => {
  try {
    const review = await Review.findOne({ user: req.user._id, expo: req.params.expoId });
    res.json({ success: true, data: review });
  } catch (err) {
    res.fail(err);
  }
});

// GET top-rated expos (for homepage badges)
router.get('/top-rated', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const minReviews = Number(req.query.minReviews) || 2;
    const top = await Review.aggregate([
      {
        $group: {
          _id: '$expo',
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: minReviews }, avg: { $gte: 4 } } },
      { $sort: { avg: -1, count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'expos', localField: '_id', foreignField: '_id', as: 'expo' } },
      { $unwind: '$expo' },
      {
        $project: {
          _id: 1,
          avg: { $round: ['$avg', 1] },
          count: 1,
          title: '$expo.title',
          startDate: '$expo.startDate',
          status: '$expo.status',
          category: '$expo.category',
        },
      },
    ]);
    res.json({ success: true, data: top });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;
