const mongoose = require('mongoose');

// A Registration is an attendee signing up for an expo. It is the source of
// truth for "is this user registered?" and carries their check-in status.
// (Attendance, created on check-in, is kept as the analytics/audit record.)
const registrationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },   // user_id
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },   // event_id
  qrToken: { type: String, unique: true, sparse: true },                         // qr_code (HMAC-signed)
  checkInStatus: { type: Boolean, default: false },                              // check_in_status
  checkInTime: { type: Date },                                                   // check_in_time
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticketIssuedAt: { type: Date, default: Date.now },
  // Payment split: attendees may pay the full entry fee up front, or pay a
  // deposit now to reserve their spot and settle the balance in person at the
  // venue. balanceDue > 0 means there is money still owed at check-in.
  payment: {
    entryFee:   { type: Number, default: 0 },   // the expo's ticket price at purchase time
    amountPaid: { type: Number, default: 0 },    // paid up front (mock checkout)
    balanceDue: { type: Number, default: 0 },    // to be collected face-to-face at the venue
    paidInFull: { type: Boolean, default: true },
    paidAt:     { type: Date, default: Date.now },
  },
}, { timestamps: true });                                                        // created_at / updated_at

// One registration per user per expo — also the guard against duplicate registrations.
registrationSchema.index({ user: 1, expo: 1 }, { unique: true });
registrationSchema.index({ expo: 1, checkInStatus: 1 });

module.exports = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
