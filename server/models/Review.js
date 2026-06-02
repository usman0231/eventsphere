const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 120 },
  comment: { type: String, trim: true, maxlength: 1500 },
}, { timestamps: true });

reviewSchema.index({ user: 1, expo: 1 }, { unique: true });
reviewSchema.index({ expo: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
