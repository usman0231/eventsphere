import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { downloadCSV, dateStamp } from '../../utils/export';

const statusStyle = {
  open: { bg:'rgba(255,179,0,0.1)', color:'#ffb300', border:'rgba(255,179,0,0.3)' },
  'in-progress': { bg:'rgba(0,212,255,0.1)', color:'#00d4ff', border:'rgba(0,212,255,0.3)' },
  resolved: { bg:'rgba(0,255,136,0.1)', color:'#00ff88', border:'rgba(0,255,136,0.3)' },
};
const typeIcon = { suggestion:'💡', bug:'🐛', complaint:'😤', compliment:'⭐' };

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchFeedback(); }, []);

  const fetchFeedback = async () => {
    try {
      const { data } = await api.get('/api/feedback');
      setFeedbacks(data.data || []);
    } catch (err) {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const exportFeedbackCSV = () => {
    if (!feedbacks.length) { toast.info('No feedback to export'); return; }
    downloadCSV(`feedback-${dateStamp()}`, feedbacks, [
      { label: 'Type', accessor: 'type' },
      { label: 'Subject', accessor: 'subject' },
      { label: 'Message', accessor: 'message' },
      { label: 'Rating', accessor: 'rating' },
      { label: 'Status', accessor: 'status' },
      { label: 'User', accessor: f => f.user?.name || 'Anonymous' },
      { label: 'Email', accessor: f => f.user?.email || '' },
      { label: 'Submitted', accessor: f => dayjs(f.createdAt).format('YYYY-MM-DD HH:mm') },
    ]);
    toast.success(`Exported ${feedbacks.length} feedback entries`);
  };

  return (
    <div className="admin-page">
      <div className="admin-orb admin-orb-1" />
      <div className="admin-orb admin-orb-2" />
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <p className="admin-tag">Administration</p>
            <h1 className="admin-title">Feedback</h1>
            <p className="admin-subtitle">User suggestions, bug reports, and compliments</p>
          </div>
          <div className="admin-export-group">
            <button className="admin-export-btn" onClick={exportFeedbackCSV} disabled={loading} title="Export all feedback">💬 Feedback CSV</button>
          </div>
        </div>

        <div className="admin-feedback">
          {loading ? (
            <div className="admin-loading">Loading feedback…</div>
          ) : feedbacks.length === 0 ? (
            <div className="admin-empty">
              <span>💬</span><p>No feedback submitted yet</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>User</th>
                    <th>Subject</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map(fb => {
                    const s = statusStyle[fb.status] || statusStyle.open;
                    return (
                      <tr key={fb._id}>
                        <td>{typeIcon[fb.type]} {fb.type}</td>
                        <td>{fb.user?.name || 'Anonymous'}</td>
                        <td className="admin-td-title">{fb.subject}</td>
                        <td>{'★'.repeat(fb.rating || 0)}</td>
                        <td><span className="admin-status-badge" style={{ background:s.bg, color:s.color, borderColor:s.border }}>{fb.status}</span></td>
                        <td>{dayjs(fb.createdAt).format('MMM D, YYYY')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
