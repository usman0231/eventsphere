const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'organizer', 'exhibitor', 'attendee'], default: 'attendee' },
  phone: { type: String },
  avatar: { type: String },
  company: { type: String },
  bio: { type: String },
  website: { type: String },
  category: { type: String },
  foundedYear: { type: String },
  companySize: { type: String },
  social: { linkedin: { type: String }, twitter: { type: String } },
  notificationPrefs: {
    applicationUpdates: { type: Boolean, default: true },
    newMessages: { type: Boolean, default: true },
    expoAnnouncements: { type: Boolean, default: true },
    sessionReminders: { type: Boolean, default: true },
    boothAlerts: { type: Boolean, default: true },
  },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyToken: String,
  emailVerifyExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, {
  timestamps: true,
  // Never leak secrets in API responses, even when a doc was loaded with .select('+password').
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      delete ret.emailVerifyToken;
      delete ret.resetPasswordToken;
      return ret;
    },
  },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);