
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo' },
  type: { type: String, enum: ['suggestion', 'bug', 'complaint', 'compliment'], default: 'suggestion' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);