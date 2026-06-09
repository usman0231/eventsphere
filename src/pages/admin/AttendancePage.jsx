import React, { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

const POLL_MS = 10000;

const STAT_CARDS = [
  { key: 'totalRegistered', label: 'Registered', icon: '🎟️', cls: 'att-stat-reg' },
  { key: 'totalCheckedIn', label: 'Checked In', icon: '✅', cls: 'att-stat-in' },
  { key: 'remaining', label: 'Remaining', icon: '⏳', cls: 'att-stat-rem' },
  { key: 'attendancePct', label: 'Attendance', icon: '📊', cls: 'att-stat-pct', suffix: '%' },
];

export default function AttendancePage() {
  const { socket } = useSocket();
  const [expos, setExpos] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ totalRegistered: 0, totalCheckedIn: 0, remaining: 0, attendancePct: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [expo, setExpo] = useState('');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Keep the latest filters available to the socket handler / poller without
  // re-subscribing on every keystroke.
  const filtersRef = useRef({ expo, status, debouncedQ });
  filtersRef.current = { expo, status, debouncedQ };

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Load the expo list once for the filter dropdown.
  useEffect(() => {
    api.get('/api/expos')
      .then(({ data }) => setExpos(data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const { expo: e, status: s, debouncedQ: query } = filtersRef.current;
    const params = new URLSearchParams();
    if (e) params.set('expo', e);
    if (s) params.set('status', s);
    if (query) params.set('q', query);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get(`/api/checkin/registrations?${params.toString()}`),
        api.get(`/api/checkin/stats${e ? `?expo=${e}` : ''}`),
      ]);
      setRows(listRes.data.data || []);
      setStats(statsRes.data.data || stats);
    } catch {
      /* transient — next poll retries */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever filters change.
  useEffect(() => { load(true); }, [expo, status, debouncedQ, load]);

  // Poll for near-real-time updates (works on Vercel where sockets are off).
  useEffect(() => {
    const id = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // If a socket is available (local dev / dedicated host), update instantly too.
  useEffect(() => {
    if (!socket) return;
    socket.emit('join', 'checkin');
    const onNew = () => load(false);
    socket.on('checkin:new', onNew);
    return () => socket.off('checkin:new', onNew);
  }, [socket, load]);

  return (
    <div className="att-page">
      <div className="att-head">
        <div>
          <h1 className="att-title">✅ Checked-In Attendees</h1>
          <p className="att-sub">Live attendance — updates automatically as tickets are scanned.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="att-stats">
        {STAT_CARDS.map(c => (
          <div key={c.key} className={`att-stat ${c.cls}`}>
            <span className="att-stat-icon">{c.icon}</span>
            <div className="att-stat-body">
              <div className="att-stat-val">{stats[c.key] ?? 0}{c.suffix || ''}</div>
              <div className="att-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="att-filters">
        <input
          className="att-search"
          type="search"
          placeholder="🔍 Search by name or email…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select className="att-select" value={expo} onChange={e => setExpo(e.target.value)}>
          <option value="">All events</option>
          {expos.map(x => <option key={x._id} value={x._id}>{x.title}</option>)}
        </select>
        <select className="att-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="checkedin">Checked in</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Email</th>
              <th>Ticket ID</th>
              <th>Check-In Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={5} className="att-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="att-empty">No attendees match these filters.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r._id}>
                <td>
                  <div className="att-name-cell">
                    <span className="att-avatar">{r.user?.name?.[0]?.toUpperCase() || '?'}</span>
                    <span>{r.user?.name || '—'}</span>
                  </div>
                </td>
                <td>{r.user?.email || '—'}</td>
                <td><code className="att-id">{r._id.slice(-8).toUpperCase()}</code></td>
                <td>{r.checkInTime ? dayjs(r.checkInTime).format('MMM D, h:mm:ss A') : '—'}</td>
                <td>
                  <span className={`att-badge ${r.checkInStatus ? 'att-badge-in' : 'att-badge-pending'}`}>
                    {r.checkInStatus ? 'Checked in' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
