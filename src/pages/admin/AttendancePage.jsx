import React, { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
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

  // Modals
  const [detailRow, setDetailRow] = useState(null);
  const [undoRow, setUndoRow] = useState(null);
  const [undoReason, setUndoReason] = useState('');
  const [undoing, setUndoing] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const filtersRef = useRef({ expo, status, debouncedQ });
  filtersRef.current = { expo, status, debouncedQ };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    // limit=100 (server max) so the filter lists all expos, not just the first page.
    api.get('/api/expos?limit=100')
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
      setStats(statsRes.data.data || { totalRegistered: 0, totalCheckedIn: 0, remaining: 0, attendancePct: 0 });
    } catch {
      /* transient — next poll retries */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [expo, status, debouncedQ, load]);

  useEffect(() => {
    const id = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join', 'checkin');
    const onChange = () => load(false);
    socket.on('checkin:new', onChange);
    socket.on('checkin:undo', onChange);
    return () => { socket.off('checkin:new', onChange); socket.off('checkin:undo', onChange); };
  }, [socket, load]);

  const confirmUndo = async () => {
    if (!undoRow || undoing) return;
    setUndoing(true);
    try {
      await api.post(`/api/checkin/${undoRow._id}/undo`, { reason: undoReason.trim() });
      toast.success(`Check-in undone for ${undoRow.user?.name || 'attendee'}`);
      setUndoRow(null);
      setUndoReason('');
      load(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not undo check-in');
    } finally {
      setUndoing(false);
    }
  };

  const openAudit = async () => {
    setShowAudit(true);
    setAuditLoading(true);
    try {
      const { data } = await api.get('/api/audit-logs');
      setAuditRows(data.data || []);
    } catch {
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="att-page">
      <div className="att-head">
        <div>
          <h1 className="att-title">✅ Checked-In Attendees</h1>
          <p className="att-sub">Live attendance — updates automatically as tickets are scanned.</p>
        </div>
        <button className="att-audit-btn" onClick={openAudit}>📋 Audit Log</button>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="att-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="att-empty">No attendees match these filters.</td></tr>
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
                <td>
                  <div className="att-actions">
                    <button className="att-act att-act-view" onClick={() => setDetailRow(r)}>View</button>
                    {r.checkInStatus && (
                      <button className="att-act att-act-undo" onClick={() => { setUndoRow(r); setUndoReason(''); }}>
                        Undo
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Details modal */}
      {detailRow && (
        <div className="att-modal-overlay" onClick={() => setDetailRow(null)}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-head">
              <h3>Attendee Details</h3>
              <button className="att-modal-x" onClick={() => setDetailRow(null)}>✕</button>
            </div>
            <div className="att-detail-grid">
              <div><span>Name</span><strong>{detailRow.user?.name || '—'}</strong></div>
              <div><span>Email</span><strong>{detailRow.user?.email || '—'}</strong></div>
              <div><span>Role</span><strong>{detailRow.user?.role || '—'}</strong></div>
              <div><span>Company</span><strong>{detailRow.user?.company || '—'}</strong></div>
              <div><span>Event</span><strong>{detailRow.expo?.title || '—'}</strong></div>
              <div><span>Ticket ID</span><strong>{detailRow._id.slice(-8).toUpperCase()}</strong></div>
              <div><span>Registered</span><strong>{detailRow.createdAt ? dayjs(detailRow.createdAt).format('MMM D, YYYY h:mm A') : '—'}</strong></div>
              <div><span>Check-In Time</span><strong>{detailRow.checkInTime ? dayjs(detailRow.checkInTime).format('MMM D, YYYY h:mm:ss A') : '—'}</strong></div>
              <div><span>Status</span><strong>{detailRow.checkInStatus ? 'Checked in' : 'Pending'}</strong></div>
            </div>
            <div className="att-modal-foot">
              {detailRow.checkInStatus && (
                <button className="att-act att-act-undo" onClick={() => { setUndoRow(detailRow); setUndoReason(''); setDetailRow(null); }}>
                  Undo Check-In
                </button>
              )}
              <button className="att-btn-ghost" onClick={() => setDetailRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Undo confirmation modal */}
      {undoRow && (
        <div className="att-modal-overlay" onClick={() => !undoing && setUndoRow(null)}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-head">
              <h3>Undo Check-In</h3>
              <button className="att-modal-x" onClick={() => !undoing && setUndoRow(null)}>✕</button>
            </div>
            <p className="att-confirm-text">
              Are you sure you want to undo <strong>{undoRow.user?.name}</strong>'s check-in?
              They'll move back to the Registered list; their data is kept and this action is logged.
            </p>
            <label className="att-reason-label">Reason (optional)</label>
            <textarea
              className="att-reason"
              rows={3}
              placeholder="e.g. scanned the wrong attendee"
              value={undoReason}
              onChange={e => setUndoReason(e.target.value)}
            />
            <div className="att-modal-foot">
              <button className="att-btn-ghost" onClick={() => setUndoRow(null)} disabled={undoing}>Cancel</button>
              <button className="att-btn-danger" onClick={confirmUndo} disabled={undoing}>
                {undoing ? 'Undoing…' : 'Undo Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit log modal */}
      {showAudit && (
        <div className="att-modal-overlay" onClick={() => setShowAudit(false)}>
          <div className="att-modal att-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="att-modal-head">
              <h3>Check-In Audit Log</h3>
              <button className="att-modal-x" onClick={() => setShowAudit(false)}>✕</button>
            </div>
            <div className="att-audit-wrap">
              <table className="att-table">
                <thead>
                  <tr><th>When</th><th>Action</th><th>Attendee</th><th>Event</th><th>By</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  {auditLoading && <tr><td colSpan={6} className="att-empty">Loading…</td></tr>}
                  {!auditLoading && auditRows.length === 0 && <tr><td colSpan={6} className="att-empty">No audit entries yet.</td></tr>}
                  {auditRows.map(a => (
                    <tr key={a._id}>
                      <td>{dayjs(a.createdAt).format('MMM D, h:mm A')}</td>
                      <td><span className="att-badge att-badge-undo">{a.action}</span></td>
                      <td>{a.attendeeName || '—'}</td>
                      <td>{a.event?.title || '—'}</td>
                      <td>{a.adminName || '—'}</td>
                      <td>{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="att-modal-foot">
              <button className="att-btn-ghost" onClick={() => setShowAudit(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
