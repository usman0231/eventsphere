const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entity: { type: String },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  status: { type: String, enum: ['success', 'failed', 'warning'], default: 'success' }
}, { timestamps: true });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);