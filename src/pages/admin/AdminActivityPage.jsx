import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { downloadCSV, dateStamp } from '../../utils/export';

export default function AdminActivityPage() {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState({ search: '', status: '' });
  const [logStats, setLogStats] = useState(null);
  const [logLoading, setLogLoading] = useState(false);

  const loadLogs = async () => {
    try {
      setLogLoading(true);
      const params = { limit: 100 };
      if (logFilter.search) params.search = logFilter.search;
      if (logFilter.status) params.status = logFilter.status;
      const [{ data: res }, { data: stats }] = await Promise.all([
        api.get('/api/activity', { params }),
        api.get('/api/activity/stats'),
      ]);
      setLogs(res.data || []);
      setLogStats(stats.data || null);
    } catch (err) {
      toast.error('Failed to load activity log');
    } finally {
      setLogLoading(false);
    }
  };

  // Reload when the status filter changes (and on mount).
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter.status]);

  // Debounced reload on search input.
  useEffect(() => {
    const t = setTimeout(loadLogs, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logFilter.search]);

  const exportLogsCSV = () => {
    if (!logs.length) { toast.info('No logs to export'); return; }
    downloadCSV(`activity-log-${dateStamp()}`, logs, [
      { label: 'When', accessor: l => dayjs(l.createdAt).format('YYYY-MM-DD HH:mm:ss') },
      { label: 'User', accessor: l => l.user?.name || '—' },
      { label: 'Role', accessor: l => l.user?.role || '' },
      { label: 'Action', accessor: 'action' },
      { label: 'Entity', accessor: 'entity' },
      { label: 'Details', accessor: 'details' },
      { label: 'Status', accessor: 'status' },
      { label: 'IP', accessor: 'ip' },
    ]);
    toast.success(`Exported ${logs.length} log entries`);
  };

  return (
    <div className="admin-page">
      <div className="admin-orb admin-orb-1" />
      <div className="admin-orb admin-orb-2" />
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <p className="admin-tag">Administration</p>
            <h1 className="admin-title">Activity Log</h1>
            <p className="admin-subtitle">Audit trail of platform actions and security events</p>
          </div>
        </div>

        <div className="admin-activity">
          {logStats && (
            <div className="admin-activity-stats">
              <div className="admin-act-stat"><span className="admin-act-stat-val">{logStats.total}</span><span className="admin-act-stat-label">Total events</span></div>
              <div className="admin-act-stat"><span className="admin-act-stat-val" style={{ color: '#00ff88' }}>{logStats.last24h}</span><span className="admin-act-stat-label">Last 24h</span></div>
              {logStats.byStatus?.map(s => (
                <div key={s._id} className="admin-act-stat">
                  <span className="admin-act-stat-val" style={{ color: s._id === 'failed' ? '#ff006e' : s._id === 'warning' ? '#ffb300' : '#00d4ff' }}>{s.count}</span>
                  <span className="admin-act-stat-label">{s._id}</span>
                </div>
              ))}
            </div>
          )}

          <div className="admin-activity-controls">
            <input
              className="admin-form-input"
              placeholder="Search action or details…"
              value={logFilter.search}
              onChange={e => setLogFilter(f => ({ ...f, search: e.target.value }))}
            />
            <select
              className="admin-form-input"
              value={logFilter.status}
              onChange={e => setLogFilter(f => ({ ...f, status: e.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="warning">Warning</option>
            </select>
            <button className="admin-export-btn" onClick={exportLogsCSV}>📥 Export CSV</button>
          </div>

          {logLoading ? (
            <div className="admin-loading">Loading log…</div>
          ) : logs.length === 0 ? (
            <div className="admin-empty"><span>🛡️</span><p>No activity matching the filter.</p></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l._id}>
                      <td>{dayjs(l.createdAt).format('MMM D, HH:mm:ss')}</td>
                      <td>{l.user?.name || <span style={{ opacity: 0.4 }}>—</span>}{l.user?.role && <span className="admin-role-tag"> {l.user.role}</span>}</td>
                      <td className="admin-td-title">{l.action}</td>
                      <td>{l.entity || <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td className="admin-td-details" title={l.details}>{l.details || <span style={{ opacity: 0.4 }}>—</span>}</td>
                      <td>
                        <span className="admin-status-badge" style={{
                          background: l.status === 'failed' ? 'rgba(255,0,110,0.15)' : l.status === 'warning' ? 'rgba(255,179,0,0.15)' : 'rgba(0,255,136,0.15)',
                          color: l.status === 'failed' ? '#ff80ab' : l.status === 'warning' ? '#ffb300' : '#00ff88',
                          borderColor: l.status === 'failed' ? 'rgba(255,0,110,0.3)' : l.status === 'warning' ? 'rgba(255,179,0,0.3)' : 'rgba(0,255,136,0.3)',
                        }}>{l.status}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(240,240,255,0.4)' }}>{l.ip || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
