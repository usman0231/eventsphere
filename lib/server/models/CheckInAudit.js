const mongoose = require('mongoose');

// Audit trail for admin check-in management actions (e.g. undoing a check-in).
// Names/ids are denormalised so the log stays readable even if a user or expo
// is later renamed or removed.
const checkInAuditSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attendeeName: { type: String },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo' },
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
  action: { type: String, enum: ['UNDO_CHECK_IN'], required: true },
  reason: { type: String },
  ip: { type: String },
}, { timestamps: true });   // createdAt = the action timestamp

checkInAuditSchema.index({ event: 1, createdAt: -1 });
checkInAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.models.CheckInAudit || mongoose.model('CheckInAudit', checkInAuditSchema);
