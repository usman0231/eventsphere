const mongoose = require('mongoose');

const exhibitorApplicationSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  companyDescription: { type: String },
  website: { type: String },
  logo: { type: String },
  products: [String],
  category: { type: String },
  boothPreference: { type: String, enum: ['small', 'medium', 'large', 'extra-large'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  assignedBooth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth' },
  documents: [{ name: String, url: String }],
  notes: { type: String },
  rejectionReason: { type: String },
}, { timestamps: true });

module.exports = mongoose.models.ExhibitorApplication || mongoose.model('ExhibitorApplication', exhibitorApplicationSchema);