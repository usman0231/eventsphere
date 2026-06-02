const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// Email links need a single, publicly-reachable URL.
// Priority: first CLIENT_URL entry → RENDER_EXTERNAL_URL (public https on Render) → localhost.
// This is why verify/reset links must NOT be a LAN IP (e.g. 192.168.x.x): they'd only work
// on that one network. On Render, RENDER_EXTERNAL_URL is injected automatically.
function primaryClientUrl() {
  const fromClientUrl = (process.env.CLIENT_URL || '').split(',').map(s => s.trim()).filter(Boolean)[0];
  return fromClientUrl || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.warn('[mailer] SMTP_HOST not set — skipping email to', to);
    return { skipped: true };
  }
  const from = process.env.SMTP_FROM || 'EventSphere <no-reply@eventsphere.test>';
  try {
    const info = await t.sendMail({ from, to, subject, html, text });
    console.log('[mailer] sent', info.messageId, 'to', to);
    return info;
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    throw err;
  }
}

// Email-client-safe wrapper: table-based layout, solid colors, inline styles.
// Gmail, Outlook, and most clients strip gradients, flexbox, and -webkit- properties.
const wrap = (title, bodyHtml) => `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background-color:#f4f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e5e5ef;">
        <tr><td style="padding:32px;">
          <h1 style="color:#6c3de8;font-size:26px;font-weight:800;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">EventSphere</h1>
          <h2 style="color:#222;font-size:20px;font-weight:700;margin:16px 0 12px;font-family:Arial,Helvetica,sans-serif;">${title}</h2>
          <div style="color:#444;font-size:15px;line-height:1.55;font-family:Arial,Helvetica,sans-serif;">
            ${bodyHtml}
          </div>
          <hr style="border:none;border-top:1px solid #eaeaef;margin:28px 0 16px;" />
          <p style="font-size:12px;color:#888;margin:0;font-family:Arial,Helvetica,sans-serif;">You're receiving this because you have an EventSphere account. If this wasn't you, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const buttonHtml = (label, href, color = '#6c3de8') => `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
    <tr><td align="center" bgcolor="${color}" style="border-radius:6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,Helvetica,sans-serif;border-radius:6px;background-color:${color};">${label}</a>
    </td></tr>
  </table>`;

async function sendWelcomeEmail(user) {
  const clientUrl = primaryClientUrl();
  const link = `${clientUrl}/expos`;
  return sendMail({
    to: user.email,
    subject: `Welcome to EventSphere, ${user.name}!`,
    html: wrap('Welcome aboard 👋', `
      <p>Hi ${user.name},</p>
      <p>Your EventSphere account is ready. You can now browse expos, register for sessions, and connect with exhibitors.</p>
      ${buttonHtml('Browse Expos', link)}
      <p style="font-size:13px;color:#666;">Or open this link: <a href="${link}" style="color:#6c3de8;word-break:break-all;">${link}</a></p>
      <p>Role assigned: <strong>${user.role}</strong></p>
    `),
    text: `Welcome to EventSphere, ${user.name}!\n\nVisit ${link} to get started.\nRole: ${user.role}`,
  });
}

async function sendVerificationEmail(user, rawToken) {
  const clientUrl = primaryClientUrl();
  const link = `${clientUrl}/verify-email/${rawToken}`;
  return sendMail({
    to: user.email,
    subject: 'Verify your EventSphere email',
    html: wrap('Confirm your email address', `
      <p>Hi ${user.name},</p>
      <p>Thanks for signing up for EventSphere! Please confirm your email address to activate your account. This link expires in <strong>24 hours</strong>.</p>
      ${buttonHtml('Verify Email', link)}
      <p style="font-size:13px;color:#666;">Or paste this URL into your browser:<br /><a href="${link}" style="color:#6c3de8;word-break:break-all;">${link}</a></p>
      <p style="font-size:13px;color:#888;">If you didn't create an EventSphere account, you can safely ignore this email.</p>
    `),
    text: `Verify your EventSphere email\n\nClick this link to confirm your account (expires in 24 hours):\n${link}\n\nIf you didn't sign up, ignore this email.`,
  });
}

async function sendPasswordResetEmail(user, rawToken) {
  const clientUrl = primaryClientUrl();
  const link = `${clientUrl}/reset-password/${rawToken}`;
  return sendMail({
    to: user.email,
    subject: 'Reset your EventSphere password',
    html: wrap('Reset your password', `
      <p>Hi ${user.name},</p>
      <p>We received a request to reset your EventSphere password. Click the button below to set a new one. This link expires in <strong>10 minutes</strong>.</p>
      ${buttonHtml('Reset Password', link)}
      <p style="font-size:13px;color:#666;">Or paste this URL into your browser:<br /><a href="${link}" style="color:#6c3de8;word-break:break-all;">${link}</a></p>
      <p style="font-size:13px;color:#888;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `),
    text: `Reset your EventSphere password\n\nClick this link to reset (expires in 10 minutes):\n${link}\n\nIf you didn't request this, ignore this email.`,
  });
}

module.exports = { sendMail, sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail };
