const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema({
  expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  name: { type: String, required: true, trim: true },
  tier: { type: String, enum: ['platinum', 'gold', 'silver', 'bronze', 'startup'], default: 'gold' },
  logo: { type: String },
  website: { type: String },
  description: { type: String },
  contactPerson: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  order: { type: Number, default: 0 },
}, { timestamps: true });

sponsorSchema.index({ expo: 1, tier: 1, order: 1 });

module.exports = mongoose.models.Sponsor || mongoose.model('Sponsor', sponsorSchema);
