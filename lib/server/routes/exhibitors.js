const express = require('express');
const router = express.Router();
const ExhibitorApplication = require('../models/ExhibitorApplication');
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const { protect, authorize } = require('../middleware/auth');
const { createNotification, logActivity } = require('../utils/notifications');

// Returns true if user may manage applications for the given expo (admin or its organizer)
async function canManageExpoApplications(user, expoId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'organizer') return false;
  const expo = await Expo.findById(expoId).select('organizer');
  return !!expo && expo.organizer.toString() === user._id.toString();
}

router.get('/expo/:expoId', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    if (!(await canManageExpoApplications(req.user, req.params.expoId))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }
    const applications = await ExhibitorApplication.find({ expo: req.params.expoId })
      .populate('user', 'name email avatar phone')
      .populate('assignedBooth')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    const applications = await ExhibitorApplication.find({ user: req.user._id })
      .populate('expo', 'title startDate endDate location status category')
      .populate('assignedBooth')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) {
    res.fail(err);
  }
});

// Withdraw (delete) the caller's own application — only while still pending, so an
// already-approved/rejected decision (and its assigned booth) can't be silently removed.
router.delete('/:id', protect, async (req, res) => {
  try {
    const application = await ExhibitorApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (application.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending applications can be withdrawn' });
    }
    await application.deleteOne();
    await logActivity({ user: req.user._id, action: 'Exhibitor Application Withdrawn', entity: 'ExhibitorApplication', entityId: application._id, req });
    res.json({ success: true, message: 'Application withdrawn' });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/', protect, authorize('attendee', 'exhibitor'), async (req, res) => {
  try {
    const existing = await ExhibitorApplication.findOne({ expo: req.body.expo, user: req.user._id });
    if (existing) return res.status(400).json({ success: false, message: 'Already applied for this expo' });

    // Block applications after the expo's registration deadline
    const expo = await Expo.findById(req.body.expo).select('registrationDeadline title');
    if (!expo) return res.status(404).json({ success: false, message: 'Expo not found' });
    if (expo.registrationDeadline && new Date() > new Date(expo.registrationDeadline)) {
      return res.status(400).json({ success: false, message: `Applications for "${expo.title}" closed on ${new Date(expo.registrationDeadline).toLocaleDateString()}` });
    }

    const application = await ExhibitorApplication.create({ ...req.body, user: req.user._id });

    const io = req.app.get('io');
    await logActivity({ user: req.user._id, action: 'Exhibitor Application Submitted', entity: 'ExhibitorApplication', entityId: application._id, req });

    res.status(201).json({ success: true, data: application });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/:id/status', protect, authorize('admin', 'organizer'), async (req, res) => {
  try {
    const { status, boothId, rejectionReason } = req.body;
    const application = await ExhibitorApplication.findById(req.params.id).populate('expo', 'title organizer');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    if (req.user.role !== 'admin' && application.expo?.organizer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this expo' });
    }

    application.status = status;
    if (status === 'approved' && boothId) {
      application.assignedBooth = boothId;
      await Booth.findByIdAndUpdate(boothId, { status: 'occupied', exhibitor: application.user });
    }
    if (status === 'rejected') application.rejectionReason = rejectionReason;
    await application.save();

    // Send notification
    const io = req.app.get('io');
    const notifTitle = status === 'approved' ? '🎉 Application Approved!' : '❌ Application Rejected';
    const notifMsg = status === 'approved'
      ? `Your exhibitor application for "${application.expo?.title}" has been approved!`
      : `Your application for "${application.expo?.title}" was rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`;

    await createNotification(io, {
      recipient: application.user,
      sender: req.user._id,
      type: status === 'approved' ? 'booth_approved' : 'booth_rejected',
      title: notifTitle,
      message: notifMsg,
      link: `/expos/${application.expo?._id}`,
      expo: application.expo?._id
    });

    await logActivity({ user: req.user._id, action: `Application ${status}`, entity: 'ExhibitorApplication', entityId: application._id, req });

    res.json({ success: true, data: application, message: `Application ${status}` });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/expo/:expoId/public', async (req, res) => {
  try {
    const exhibitors = await ExhibitorApplication.find({ expo: req.params.expoId, status: 'approved' })
      .populate('user', 'name avatar company')
      .populate('assignedBooth', 'boothNumber location');
    res.json({ success: true, data: exhibitors });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;