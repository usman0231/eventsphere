const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  title: { type: String, required: true },
  description: { type: String },
  speaker: { name: String, bio: String, avatar: String, company: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  location: { type: String },
  category: { type: String },
  maxAttendees: { type: Number },
  registeredAttendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags: [String],
  isRecorded: { type: Boolean, default: false },
  streamUrl: { type: String },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);