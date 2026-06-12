import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import api from '../../utils/api';

export default function AdminExpoApprovalsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectRow, setRejectRow] = useState(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      const { data } = await api.get('/api/expos/pending');
      setRows(data.data || []);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(true); }, []);

  const approve = async (row) => {
    setBusyId(row._id);
    try {
      await api.put(`/api/expos/${row._id}/approve`);
      toast.success(`Approved "${row.title}" — it's now live`);
      setRows(rs => rs.filter(r => r._id !== row._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve expo');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectRow) return;
    setBusyId(rejectRow._id);
    try {
      await api.put(`/api/expos/${rejectRow._id}/reject`, { reason: reason.trim() });
      toast.success(`Rejected "${rejectRow.title}"`);
      setRows(rs => rs.filter(r => r._id !== rejectRow._id));
      setRejectRow(null);
      setReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject expo');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="att-page">
      <div className="att-head">
        <div>
          <h1 className="att-title">🗂️ Expo Approvals</h1>
          <p className="att-sub">Review expos submitted by organizers. Approving publishes them; rejecting sends the organizer your reason.</p>
        </div>
      </div>

      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>Expo</th>
              <th>Organizer</th>
              <th>Category</th>
              <th>Dates</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="att-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="att-empty">🎉 No expos waiting for approval.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r._id}>
                <td>
                  <div className="att-name-cell">
                    <span className="att-avatar">🎪</span>
                    <button className="att-act att-act-view" style={{ background: 'none', padding: 0 }} onClick={() => navigate(`/expos/${r._id}`)}>{r.title}</button>
                  </div>
                </td>
                <td>{r.organizer?.name || '—'}<br /><span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{r.organizer?.email || ''}</span></td>
                <td>{r.category || '—'}</td>
                <td>{r.startDate ? `${dayjs(r.startDate).format('MMM D')} – ${dayjs(r.endDate).format('MMM D, YYYY')}` : '—'}</td>
                <td>{dayjs(r.createdAt).format('MMM D, YYYY')}</td>
                <td>
                  <div className="att-actions">
                    <button className="att-act att-act-view" onClick={() => approve(r)} disabled={busyId === r._id}>
                      {busyId === r._id ? '…' : 'Approve'}
                    </button>
                    <button className="att-act att-act-undo" onClick={() => { setRejectRow(r); setReason(''); }} disabled={busyId === r._id}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reject reason modal */}
      {rejectRow && (
        <div className="att-modal-overlay" onClick={() => busyId == null && setRejectRow(null)}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-head">
              <h3>Reject Expo</h3>
              <button className="att-modal-x" onClick={() => setRejectRow(null)}>✕</button>
            </div>
            <p className="att-confirm-text">
              Reject <strong>{rejectRow.title}</strong>? The organizer will be notified with your reason and can resubmit after changes.
            </p>
            <label className="att-reason-label">Reason</label>
            <textarea
              className="att-reason"
              rows={3}
              placeholder="e.g. dates clash with another event; description needs more detail"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="att-modal-foot">
              <button className="att-btn-ghost" onClick={() => setRejectRow(null)} disabled={busyId != null}>Cancel</button>
              <button className="att-btn-danger" onClick={confirmReject} disabled={busyId != null}>
                {busyId != null ? 'Rejecting…' : 'Reject Expo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
