const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { attachFail, mapError } = require('./utils/errorResponse');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS/Socket.IO — comma-separated CLIENT_URL plus localhost variants for dev
const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean),
  process.env.RENDER_EXTERNAL_URL,        // auto-injected by Render → allows the deployed origin
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);
const corsOrigin = (origin, cb) => {
  // Allow requests with no origin (curl, mobile apps) and any LAN origin during dev
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  // Allow any LAN IP in the form http://192.168.x.x:3000 or http://10.x.x.x:3000
  if (/^http:\/\/(192\.168|10|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+:\d+$/.test(origin)) return cb(null, true);
  cb(new Error(`CORS blocked: ${origin}`));
};

// Socket.IO
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true }
});

app.set('io', io);

// Security headers — keep crossOriginResourcePolicy permissive so /uploads images load cross-origin from the client dev server
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS - must be before other middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL-injection guard — strip keys starting with $ or containing . from req.body and req.query
// (Express 5 made req.query read-only, so we mutate in place rather than reassigning.)
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

// Static files
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

// Unknown API route → JSON 404 (don't fall through to the SPA catch-all below)
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'API route not found' }));

// Serve client production build on same origin when SERVE_CLIENT=1.
// Lets one tunnel (e.g. ngrok http 5000) expose both the PWA and the API,
// so the service worker and install prompt work on mobile over HTTPS.
if (process.env.SERVE_CLIENT === '1') {
  const clientBuild = path.join(__dirname, '..', 'client', 'build');
  app.use(express.static(clientBuild));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Session reminder scheduler — fires ~10 min before session startTime
const Session = require('./models/Session');
const Notification = require('./models/Notification');
const { createNotification } = require('./utils/notifications');

const checkSessionReminders = async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);
    const sessions = await Session.find({
      startTime: { $gte: windowStart, $lte: windowEnd },
      status: 'scheduled'
    }).populate('expo', 'title');

    for (const s of sessions) {
      const attendees = (s.registeredAttendees || []).map(String);
      for (const uid of attendees) {
        const already = await Notification.findOne({
          recipient: uid,
          type: 'session_reminder',
          'metadata.sessionId': s._id.toString()
        });
        if (already) continue;
        await createNotification(io, {
          recipient: uid,
          type: 'session_reminder',
          title: `⏰ Session starts in ~10 minutes`,
          message: `"${s.title}" at ${s.location || s.expo?.title || 'the venue'}`,
          link: `/expos/${s.expo?._id || ''}`,
          expo: s.expo?._id,
          metadata: { sessionId: s._id.toString() }
        });
      }
    }
  } catch (err) {
    console.error('Session reminder error:', err.message);
  }
};

setInterval(checkSessionReminders, 60 * 1000);

// Socket.IO events
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined`);
  });

  socket.on('join_expo', (expoId) => {
    socket.join(`expo_${expoId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Central error handler — maps known errors to safe responses, hides 500 internals in prod.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const { status, body } = mapError(err);
  if (status >= 500) console.error('[API error]', err && err.stack ? err.stack : err);
  res.status(status).json(body);
});

// Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eventsphere';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

module.exports = { io };