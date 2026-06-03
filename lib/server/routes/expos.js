const express = require('express');
const router = express.Router();
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const ExhibitorApplication = require('../models/ExhibitorApplication');
const { protect, authorize } = require('../middleware/auth');
const { createNotification, logActivity } = require('../utils/notifications');

router.get('/', async (req, res) => {
  try {
    const { status, category, search, sort, dateRange, priceRange } = req.query;
    // Clamp pagination so a client can't request an unbounded page size.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const query = { isPublic: true };
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      const rx = { $regex: search, $options: 'i' };
      query.$or = [
        { title: rx },
        { description: rx },
        { theme: rx },
        { 'location.city': rx },
        { 'location.venue': rx },
        { tags: rx },
      ];
    }
    if (priceRange === 'free') query.entryFee = { $in: [0, null] };
    else if (priceRange === 'paid') query.entryFee = { $gt: 0 };

    const now = new Date();
    if (dateRange === 'upcoming') query.startDate = { $gte: now };
    else if (dateRange === 'past') query.endDate = { $lt: now };
    else if (dateRange === 'month') {
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      query.startDate = { $gte: now, $lte: monthEnd };
    }

    let sortSpec;
    if (sort === 'name') sortSpec = { title: 1 };
    else if (sort === 'recent') sortSpec = { createdAt: -1 };
    else if (sort === 'date-desc') sortSpec = { startDate: -1 };
    else sortSpec = { startDate: 1 };

    if (sort === 'popular') {
      // Sort by attendance count via aggregation
      const matchStage = { ...query };
      const pipeline = [
        { $match: matchStage },
        { $lookup: { from: 'attendances', localField: '_id', foreignField: 'expo', as: 'attendees' } },
        { $addFields: { attendeeCount: { $size: '$attendees' } } },
        { $sort: { attendeeCount: -1, startDate: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
        { $lookup: { from: 'users', localField: 'organizer', foreignField: '_id', as: 'organizer' } },
        { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } },
        { $project: { attendees: 0, 'organizer.password': 0 } },
      ];
      const [expos, total] = await Promise.all([
        Expo.aggregate(pipeline),
        Expo.countDocuments(matchStage),
      ]);
      return res.json({ success: true, data: expos, total, page: Number(page), pages: Math.ceil(total / limit) });
    }

    const total = await Expo.countDocuments(query);
    const expos = await Expo.find(query)
      .populate('organizer', 'name avatar')
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, data: expos, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/my/organized', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expos = await Expo.find({ organizer: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: expos });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.id).populate('organizer', 'name avatar company');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    res.json({ success: true, data: expo });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expo = await Expo.create({ ...req.body, organizer: req.user._id });
    const boothCount = expo.totalBooths || 20;
    const booths = [];
    for (let i = 1; i <= boothCount; i++) {
      booths.push({ expo: expo._id, boothNumber: `B${String(i).padStart(3,'0')}`, size: i <= 5 ? 'large' : i <= 15 ? 'medium' : 'small' });
    }
    await Booth.insertMany(booths);
    await logActivity({ user: req.user._id, action: 'Expo Created', entity: 'Expo', entityId: expo._id, details: expo.title, req });
    res.status(201).json({ success: true, data: expo });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.id);
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this expo' });
    }
    const prevStatus = expo.status;
    const updated = await Expo.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    await logActivity({ user: req.user._id, action: 'Expo Updated', entity: 'Expo', entityId: updated._id, details: `${updated.title}${req.body.status && req.body.status !== prevStatus ? ` → status: ${req.body.status}` : ''}`, req });

    if (req.body.status && req.body.status !== prevStatus) {
      const io = req.app.get('io');
      const apps = await ExhibitorApplication.find({ expo: updated._id, status: 'approved' }).select('user');
      const statusMsg = {
        published: `📢 "${updated.title}" is now live and open for registrations`,
        ongoing:   `🔴 "${updated.title}" is happening now`,
        completed: `✅ "${updated.title}" has concluded — thanks for participating`,
        cancelled: `⚠️ "${updated.title}" has been cancelled`,
      }[updated.status];
      if (statusMsg) {
        for (const app of apps) {
          await createNotification(io, {
            recipient: app.user,
            sender: req.user._id,
            type: 'expo_update',
            title: `Expo update: ${updated.status}`,
            message: statusMsg,
            link: `/expos/${updated._id}`,
            expo: updated._id
          });
        }
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.fail(err);
  }
});

router.delete('/:id', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.id);
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await expo.deleteOne();
    await Booth.deleteMany({ expo: req.params.id });
    await logActivity({ user: req.user._id, action: 'Expo Deleted', entity: 'Expo', entityId: req.params.id, details: expo.title, req, status: 'warning' });
    res.json({ success: true, message: 'Expo deleted successfully' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;