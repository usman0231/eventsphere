const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, resendVerificationRules } = require('../validators/auth');
const { createNotification, logActivity } = require('../utils/notifications');
const { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } = require('../utils/mailer');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

router.post('/register', registerRules, validate, async (req, res) => {
  try {
    const { name, email, password, role, company, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    // Self-signup is limited to attendee & exhibitor. organizer/admin are created by an admin / seed.
    const SELF_SIGNUP_ROLES = ['attendee', 'exhibitor'];
    const safeRole = SELF_SIGNUP_ROLES.includes(role) ? role : 'attendee';

    // 6-digit verification code — emailed; the user enters it on the sign-up page (no new tab).
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const user = await User.create({
      name, email, password, role: safeRole, company, phone,
      isEmailVerified: false,
      emailVerifyToken: hashedCode,
      emailVerifyExpire: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Audit log is fire-and-forget — the client shouldn't wait on this DB write.
    logActivity({ user: user._id, action: 'User Registered', entity: 'User', entityId: user._id, details: `Role: ${user.role}`, req }).catch(() => {});

    // Email the 6-digit code (fire-and-forget so registration responds fast). The user reads
    // it from their inbox and enters it on the sign-up page — real email verification, no new tab.
    sendVerificationEmail(user, code).catch(err => console.error('Verification email failed:', err.message));

    res.status(201).json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      message: 'Account created! Check your email for a 6-digit verification code.',
      verificationRequired: true,
    });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    }
    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    // Now send the welcome email + in-app notification (only after verifying)
    const io = req.app.get('io');
    await createNotification(io, {
      recipient: user._id,
      type: 'welcome',
      title: `👋 Welcome to EventSphere, ${user.name}!`,
      message: 'Your email is verified. Browse upcoming expos, register for sessions, and connect with exhibitors.',
      link: '/expos',
    });
    sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message));
    await logActivity({ user: user._id, action: 'Email Verified', entity: 'User', entityId: user._id, req });

    const token = signToken(user._id);
    res.json({ success: true, token, user, message: 'Email verified! You are now logged in.' });
  } catch (err) {
    res.fail(err);
  }
});

// Code-based verification — user enters the 6-digit code on the sign-up page (same tab, no link).
router.post('/verify-code', async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const code = String(req.body.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      email,
      emailVerifyToken: hashedCode,
      emailVerifyExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }
    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save();

    const io = req.app.get('io');
    await createNotification(io, {
      recipient: user._id,
      type: 'welcome',
      title: `👋 Welcome to EventSphere, ${user.name}!`,
      message: 'Your email is verified. Browse upcoming expos, register for sessions, and connect with exhibitors.',
      link: '/expos',
    });
    sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message));
    await logActivity({ user: user._id, action: 'Email Verified', entity: 'User', entityId: user._id, req });

    const token = signToken(user._id);
    res.json({ success: true, token, user, message: 'Email verified! You are now logged in.' });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/resend-verification', resendVerificationRules, validate, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    // Always respond the same way to avoid leaking which emails are registered
    const genericResponse = { success: true, message: 'If that email exists and is unverified, a new link has been sent.' };
    if (!user || user.isEmailVerified) return res.json(genericResponse);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.emailVerifyToken = crypto.createHash('sha256').update(code).digest('hex');
    user.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    sendVerificationEmail(user, code).catch(err => console.error('Verification resend failed:', err.message));
    res.json(genericResponse);
  } catch (err) {
    res.fail(err);
  }
});

router.post('/login', loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      logActivity({ action: 'Login Failed', entity: 'User', details: `Email: ${email}`, req, status: 'failed' }).catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.isActive === false) {
      logActivity({ user: user._id, action: 'Login Blocked (Suspended)', entity: 'User', entityId: user._id, req, status: 'failed' }).catch(() => {});
      return res.status(403).json({ success: false, message: 'This account has been suspended. Contact an administrator.' });
    }
    // Block login for users created after the email-verification feature shipped who haven't verified.
    // Existing pre-feature users have isEmailVerified === undefined and are not blocked.
    if (user.isEmailVerified === false) {
      logActivity({ user: user._id, action: 'Login Blocked (Unverified)', entity: 'User', entityId: user._id, req, status: 'failed' }).catch(() => {});
      return res.status(403).json({ success: false, verificationRequired: true, message: 'Please verify your email first. Check your inbox for the verification link.' });
    }
    user.lastLoginAt = new Date();
    const token = signToken(user._id);
    // Audit log + lastLoginAt write are fire-and-forget — don't make the user wait on them.
    user.save().catch(() => {});
    logActivity({ user: user._id, action: 'User Login', entity: 'User', entityId: user._id, req }).catch(() => {});
    res.json({ success: true, token, user });
  } catch (err) {
    res.fail(err);
  }
});

router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

const { authorize } = require('../middleware/auth');

router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users, total: users.length });
  } catch (err) {
    res.fail(err);
  }
});

// Refuse if removing/suspending this admin would leave zero active admins
async function wouldLeaveNoAdmins(targetUser) {
  if (targetUser.role !== 'admin') return false;
  const otherActiveAdmins = await User.countDocuments({
    _id: { $ne: targetUser._id },
    role: 'admin',
    isActive: { $ne: false },
  });
  return otherActiveAdmins === 0;
}

router.delete('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account here' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (await wouldLeaveNoAdmins(user)) {
      return res.status(400).json({ success: false, message: 'Cannot delete the last active admin' });
    }

    const id = user._id;
    const Expo = require('../models/Expo');

    // Guard: an organizer who still owns expos can't be deleted — that would orphan
    // events, sessions, booths and check-ins. Reassign/remove those expos first.
    const ownedExpos = await Expo.countDocuments({ organizer: id });
    if (ownedExpos > 0) {
      return res.status(400).json({ success: false, message: `This user owns ${ownedExpos} expo(s). Delete or reassign those expos before deleting the user.` });
    }

    // Cascade: wipe everything tied to this user so nothing lingers (login history,
    // notifications, reviews, etc.) and the email is fully freed for re-registration.
    const ActivityLog = require('../models/ActivityLog');
    const Notification = require('../models/Notification');
    const Review = require('../models/Review');
    const Attendance = require('../models/Attendance');
    const Feedback = require('../models/Feedback');
    const Message = require('../models/Message');
    const ExhibitorApplication = require('../models/ExhibitorApplication');
    const Session = require('../models/Session');
    const Booth = require('../models/Booth');

    await Promise.all([
      ActivityLog.deleteMany({ user: id }),
      Notification.deleteMany({ $or: [{ recipient: id }, { sender: id }] }),
      Review.deleteMany({ user: id }),
      Attendance.deleteMany({ $or: [{ user: id }, { scannedBy: id }] }),
      Feedback.deleteMany({ user: id }),
      Message.deleteMany({ $or: [{ sender: id }, { recipient: id }] }),
      ExhibitorApplication.deleteMany({ user: id }),
      Session.updateMany({ registeredAttendees: id }, { $pull: { registeredAttendees: id } }),
      Booth.updateMany({ exhibitor: id }, { $set: { exhibitor: null, status: 'available' } }),
    ]);

    const label = `${user.name} (${user.email})`;
    await user.deleteOne();
    await logActivity({ user: req.user._id, action: 'User Deleted', entity: 'User', entityId: req.params.id, details: label, req, status: 'warning' });
    res.json({ success: true, message: 'User and all related data deleted' });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/users/:id/suspend', protect, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const desired = typeof req.body.isActive === 'boolean' ? req.body.isActive : !user.isActive;
    // Only the "suspend" direction can leave the system admin-less
    if (desired === false && await wouldLeaveNoAdmins(user)) {
      return res.status(400).json({ success: false, message: 'Cannot suspend the last active admin' });
    }
    user.isActive = desired;
    await user.save();
    await logActivity({ user: req.user._id, action: desired ? 'User Activated' : 'User Suspended', entity: 'User', entityId: user._id, details: `${user.name} (${user.email})`, req, status: 'warning' });
    res.json({ success: true, data: user, message: desired ? 'User activated' : 'User suspended' });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/updateprofile', protect, async (req, res) => {
  try {
    const { name, phone, company, bio, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone, company, bio, avatar }, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/changepassword', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.fail(err);
  }
});

router.post('/forgotpassword', forgotPasswordRules, validate, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'This email is not registered. Please sign up first.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendPasswordResetEmail(user, token);
    } catch (err) {
      // Roll back the token so the user can retry
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.status(500).json({ success: false, message: 'Could not send reset email. Try again later.' });
    }

    res.json({ success: true, message: 'Reset link sent! Check your email — the link expires in 10 minutes.' });
  } catch (err) {
    res.fail(err);
  }
});

router.put('/resetpassword/:token', resetPasswordRules, validate, async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    const token = signToken(user._id);
    res.json({ success: true, token, message: 'Password reset successful' });
  } catch (err) {
    res.fail(err);
  }
});

module.exports = router;