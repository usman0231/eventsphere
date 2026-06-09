const crypto = require('crypto');

// Secret for signing QR tokens. Reuses the auth secret unless a dedicated one is
// set. Falls back to a constant only so dev without env still runs (tokens just
// aren't secret in that case) — production always has JWT_SECRET.
const SECRET = process.env.CHECKIN_SECRET || process.env.JWT_SECRET || 'eventsphere-dev-checkin-secret';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Sign a compact, tamper-evident QR token: base64url(payload).base64url(hmac).
// payload = { rid (registration id), uid (user id), eid (expo id), iat }.
function signToken({ rid, uid, eid }) {
  const payload = JSON.stringify({ rid: String(rid), uid: String(uid), eid: String(eid), iat: Date.now() });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// Verify signature (constant-time) and return the payload, or null if the token
// is malformed or tampered with.
function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
