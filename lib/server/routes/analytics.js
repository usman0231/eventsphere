const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const Session = require('../models/Session');
const ExhibitorApplication = require('../models/ExhibitorApplication');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');

router.get('/dashboard', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const isOrganizer = req.user.role === 'organizer';
    const expoFilter = isOrganizer ? { organizer: req.user._id } : {};

    let scopedExpoIds = null;
    if (isOrganizer) {
      const myExpos = await Expo.find({ organizer: req.user._id }).select('_id');
      scopedExpoIds = myExpos.map(e => e._id);
    }
    const attendanceMatch = scopedExpoIds ? { expo: { $in: scopedExpoIds } } : {};
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // All of these queries are independent of each other, so run them in one parallel
    // batch instead of awaiting each in turn. The endpoint then takes about as long as
    // the slowest single query rather than the sum of ~10 sequential Atlas round-trips.
    const [
      totalExpos,
      totalUsers,
      totalBooths,
      totalApplications,
      totalAttendance,
      recentExpos,
      boothStats,
      userRoles,
      applicationStats,
      attendanceOverTime,
      peakHours,
      topExpos,
      attendeeRoles,
      revenueAgg,
    ] = await Promise.all([
      Expo.countDocuments(expoFilter),
      isOrganizer ? Promise.resolve(0) : User.countDocuments(),
      Booth.countDocuments(scopedExpoIds ? { expo: { $in: scopedExpoIds } } : {}),
      ExhibitorApplication.countDocuments(scopedExpoIds ? { expo: { $in: scopedExpoIds } } : {}),
      Attendance.countDocuments(attendanceMatch),

      Expo.find(expoFilter).sort({ createdAt: -1 }).limit(5).populate('organizer', 'name'),

      Booth.aggregate([
        ...(scopedExpoIds ? [{ $match: { expo: { $in: scopedExpoIds } } }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      isOrganizer ? Promise.resolve([]) : User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      ExhibitorApplication.aggregate([
        ...(scopedExpoIds ? [{ $match: { expo: { $in: scopedExpoIds } } }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Attendance over time (last 14 days)
      Attendance.aggregate([
        { $match: { ...attendanceMatch, createdAt: { $gte: fourteenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Peak check-in hours (0-23)
      Attendance.aggregate([
        { $match: attendanceMatch },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // Top expos by attendance
      Attendance.aggregate([
        { $match: attendanceMatch },
        { $group: { _id: '$expo', attendees: { $sum: 1 } } },
        { $sort: { attendees: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'expos', localField: '_id', foreignField: '_id', as: 'expo' } },
        { $unwind: '$expo' },
        {
          $project: {
            _id: 1,
            attendees: 1,
            title: '$expo.title',
            startDate: '$expo.startDate',
            entryFee: { $ifNull: ['$expo.entryFee', 0] },
            status: '$expo.status',
            revenue: { $multiply: ['$attendees', { $ifNull: ['$expo.entryFee', 0] }] },
          },
        },
      ]),

      // Attendee role breakdown
      Attendance.aggregate([
        { $match: attendanceMatch },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $group: { _id: '$user.role', count: { $sum: 1 } } },
      ]),

      // Total revenue: sum(attendance * expo.entryFee) for expos with paid entry
      Attendance.aggregate([
        { $match: attendanceMatch },
        { $lookup: { from: 'expos', localField: 'expo', foreignField: '_id', as: 'expo' } },
        { $unwind: '$expo' },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$expo.entryFee', 0] } } } },
      ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        scope: isOrganizer ? 'organizer' : 'admin',
        totalExpos,
        totalUsers,
        totalBooths,
        totalApplications,
        totalAttendance,
        totalRevenue,
        recentExpos,
        boothStats,
        userRoles,
        applicationStats,
        attendanceOverTime,
        peakHours,
        topExpos,
        attendeeRoles,
      },
    });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/my-booth', protect, authorize('exhibitor', 'admin'), async (req, res) => {
  try {
    const userId = req.user._id;
    const [booths, applications] = await Promise.all([
      Booth.find({ exhibitor: userId }).populate('expo', 'title startDate endDate status'),
      ExhibitorApplication.find({ user: userId }).populate('expo', 'title startDate status'),
    ]);
    const applicationStats = {
      pending: applications.filter(a => a.status === 'pending').length,
      approved: applications.filter(a => a.status === 'approved').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      total: applications.length,
    };
    const boothStats = {
      reserved: booths.filter(b => b.status === 'reserved').length,
      occupied: booths.filter(b => b.status === 'occupied').length,
      total: booths.length,
    };
    res.json({
      success: true,
      data: { boothStats, applicationStats, booths, applications },
    });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/expo/:expoId', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const expo = await Expo.findById(req.params.expoId).select('organizer');
      if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
      if (expo.organizer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
      }
    }
    const [booths, sessions, applications] = await Promise.all([
      Booth.find({ expo: req.params.expoId }),
      Session.find({ expo: req.params.expoId }),
      ExhibitorApplication.find({ expo: req.params.expoId })
    ]);
    const boothOccupancy = {
      available: booths.filter(b => b.status === 'available').length,
      reserved: booths.filter(b => b.status === 'reserved').length,
      occupied: booths.filter(b => b.status === 'occupied').length,
      total: booths.length
    };
    const sessionStats = sessions.map(s => ({
      title: s.title,
      registered: s.registeredAttendees?.length || 0,
      capacity: s.maxAttendees || 'unlimited'
    }));
    res.json({ success: true, data: { boothOccupancy, sessionStats, applications: applications.length } });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;