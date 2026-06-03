const mongoose = require('mongoose');

const boothSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  boothNumber: { type: String, required: true },
  size: { type: String, enum: ['small', 'medium', 'large', 'extra-large'], default: 'medium' },
  price: { type: Number, default: 0 },
  status: { type: String, enum: ['available', 'reserved', 'occupied'], default: 'available' },
  location: { row: String, column: String, zone: String },
  description: { type: String },
  products: [String],
  staffCount: { type: Number, default: 0 },
  amenities: [String],
  notes: { type: String },
}, { timestamps: true });

boothSchema.index({ expo: 1, boothNumber: 1 }, { unique: true });

module.exports = mongoose.models.Booth || mongoose.model('Booth', boothSchema);