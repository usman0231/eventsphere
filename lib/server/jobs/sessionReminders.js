const Session = require('../models/Session');
const Notification = require('../models/Notification');
const { createNotification } = require('../utils/notifications');

// No-op realtime stub used on serverless (no persistent Socket.IO there).
// Notifications are still written to the DB; they just aren't pushed live.
const noopIo = { to: () => ({ emit: () => {} }) };

// Fires ~10 min before a session's startTime. Safe to call repeatedly —
// it skips recipients who already have the reminder notification.
async function runSessionReminders(io = noopIo) {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);

  const sessions = await Session.find({
    startTime: { $gte: windowStart, $lte: windowEnd },
    status: 'scheduled',
  }).populate('expo', 'title');

  let sent = 0;
  for (const s of sessions) {
    const attendees = (s.registeredAttendees || []).map(String);
    for (const uid of attendees) {
      const already = await Notification.findOne({
        recipient: uid,
        type: 'session_reminder',
        'metadata.sessionId': s._id.toString(),
      });
      if (already) continue;
      await createNotification(io, {
        recipient: uid,
        type: 'session_reminder',
        title: `⏰ Session starts in ~10 minutes`,
        message: `"${s.title}" at ${s.location || s.expo?.title || 'the venue'}`,
        link: `/expos/${s.expo?._id || ''}`,
        expo: s.expo?._id,
        metadata: { sessionId: s._id.toString() },
      });
      sent++;
    }
  }
  return sent;
}

module.exports = { runSessionReminders };
