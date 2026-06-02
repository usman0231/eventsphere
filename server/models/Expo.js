const mongoose = require('mongoose');

const expoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  theme: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  location: {
    venue: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    coordinates: { lat: Number, lng: Number }
  },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'], default: 'draft' },
  category: { type: String },
  maxAttendees: { type: Number },
  registrationDeadline: { type: Date },
  entryFee: { type: Number, default: 0 },
  banner: { type: String },
  floorPlan: { type: String },
  totalBooths: { type: Number, default: 50 },
  tags: [String],
  isPublic: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Expo', expoSchema);