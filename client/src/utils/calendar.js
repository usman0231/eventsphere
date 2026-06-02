// Generate an RFC 5545 .ics file for a calendar event.
// Works with Google Calendar, Outlook, Apple Calendar, and any standards-compliant client.

const pad = (n) => String(n).padStart(2, '0');

function fmtUTC(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function fold(line) {
  // RFC 5545 §3.1 — lines longer than 75 octets must be folded
  if (line.length <= 75) return line;
  const out = [];
  for (let i = 0; i < line.length; i += 73) {
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
  }
  return out.join('\r\n');
}

function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildICS({ id, title, description, location, start, end, url }) {
  const stamp = fmtUTC(new Date());
  const uid = `${id || Math.random().toString(36).slice(2)}@eventsphere`;
  const dtStart = fmtUTC(start);
  const dtEnd = fmtUTC(end || new Date(new Date(start).getTime() + 60 * 60 * 1000));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventSphere//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    fold(`SUMMARY:${escapeICS(title)}`),
    description ? fold(`DESCRIPTION:${escapeICS(description)}`) : null,
    location ? fold(`LOCATION:${escapeICS(location)}`) : null,
    url ? fold(`URL:${escapeICS(url)}`) : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadICS(filename, event) {
  const ics = buildICS(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Google Calendar quick-add URL (opens a pre-filled event creator)
export function googleCalendarURL({ title, description, location, start, end }) {
  const dt = (d) => fmtUTC(d);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Event',
    dates: `${dt(start)}/${dt(end || new Date(new Date(start).getTime() + 60 * 60 * 1000))}`,
    details: description || '',
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
