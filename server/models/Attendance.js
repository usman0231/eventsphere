const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ticketIssuedAt: { type: Date },
}, { timestamps: true });

attendanceSchema.index({ user: 1, expo: 1 }, { unique: true });
attendanceSchema.index({ expo: 1, createdAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
