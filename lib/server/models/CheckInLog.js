const mongoose = require('mongoose');

// Audit trail of every check-in attempt — successful or not — satisfying the
// "log all check-in attempts" security requirement. Failed attempts (forged /
// expired / not registered) are logged with whatever context is available.
const checkInLogSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  result: {
    type: String,
    enum: ['success', 'already_checked_in', 'not_registered', 'invalid', 'forged', 'expired', 'wrong_event', 'unauthorized'],
    required: true,
  },
  message: { type: String },
  ip: { type: String },
}, { timestamps: true });

checkInLogSchema.index({ expo: 1, createdAt: -1 });

module.exports = mongoose.models.CheckInLog || mongoose.model('CheckInLog', checkInLogSchema);
