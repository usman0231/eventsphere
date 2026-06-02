const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo' },
  subject: { type: String },
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { type: String, enum: ['inquiry', 'support', 'collaboration', 'general'], default: 'general' },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);