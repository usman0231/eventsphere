const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { attachFail, mapError } = require('./utils/errorResponse');

const app = express();

// Behind Vercel's proxy — trust the first hop so req.ip / rate-limit work correctly.
app.set('trust proxy', 1);

// Allowed origins for CORS — comma-separated CLIENT_URL plus the Vercel deploy URL
// and localhost variants for dev. (Same-origin requests on Vercel skip CORS anyway.)
const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  process.env.RENDER_EXTERNAL_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  // Allow any LAN IP like http://192.168.x.x:3000 during dev
  if (/^http:\/\/(192\.168|10|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+:\d+$/.test(origin)) return cb(null, true);
  cb(new Error(`CORS blocked: ${origin}`));
};

// On serverless there is no persistent Socket.IO, so emits are silently dropped.
// Real Socket.IO is attached only for local dev (see index.js, which overrides this).
// Notifications are still persisted to the DB and shown on the next fetch.
const noopIo = { to: () => ({ emit: () => {} }), emit: () => {} };
app.set('io', noopIo);

// Security headers — keep crossOriginResourcePolicy permissive so images load cross-origin
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS - must be before other middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL-injection guard — strip keys starting with $ or containing . from req body/query/params
const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object') {
      sanitizeInPlace(obj[key]);
    }
  }
};
app.use((req, res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.query);
  sanitizeInPlace(req.params);
  next();
});

// Rate limiting — global cap and a tighter cap for auth endpoints
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many auth attempts. Try again later.' } });
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgotpassword', authLimiter);

// Static uploads — used by local dev only. On Vercel, images live on Cloudinary.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Expose res.fail(err) → maps errors to safe responses without leaking internals
app.use(attachFail);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/expos', require('./routes/expos'));
app.use('/api/exhibitors', require('./routes/exhibitors'));
app.use('/api/booths', require('./routes/booths'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/sponsors', require('./routes/sponsors'));
app.use('/api/attendees', require('./routes/attendees'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/upload', require('./routes/upload'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EventSphere API running' });
});

// Session-reminder job — replaces the always-on setInterval used in local dev.
// On Vercel this is hit by a scheduled Cron (see vercel.json). Protected by CRON_SECRET.
app.get('/api/cron/session-reminders', async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const { runSessionReminders } = require('./jobs/sessionReminders');
    const sent = await runSessionReminders(req.app.get('io'));
    res.json({ success: true, sent });
  } catch (err) {
    console.error('Cron session-reminders error:', err.message);
    res.status(500).json({ success: false, message: 'Job failed' });
  }
});

// Unknown API route → JSON 404 (don't fall through)
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API route not found' }));

// Central error handler — maps known errors to safe responses, hides 500 internals in prod.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const { status, body } = mapError(err);
  if (status >= 500) console.error('[API error]', err && err.stack ? err.stack : err);
  res.status(status).json(body);
});

module.exports = app;
