import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import api from '../../utils/api';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const STAT_CARDS = [
  { key: 'count', label: 'Payments', icon: '🧾', cls: 'att-stat-reg' },
  { key: 'collected', label: 'Collected', icon: '💰', cls: 'att-stat-in', money: true },
  { key: 'outstanding', label: 'Due at venue', icon: '💵', cls: 'att-stat-rem', money: true },
];

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ count: 0, collected: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all'); // all | full | deposit

  useEffect(() => {
    let alive = true;
    api.get('/api/registrations/payments')
      .then(({ data }) => {
        if (!alive) return;
        setRows(data.data || []);
        setSummary(data.summary || { count: 0, collected: 0, outstanding: 0 });
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (status === 'full' && r.payment?.balanceDue > 0) return false;
      if (status === 'deposit' && !(r.payment?.balanceDue > 0)) return false;
      if (!needle) return true;
      return (
        r.user?.name?.toLowerCase().includes(needle) ||
        r.user?.email?.toLowerCase().includes(needle) ||
        r.expo?.title?.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, status]);

  return (
    <div className="att-page">
      <div className="att-head">
        <div>
          <h1 className="att-title">💳 Payments</h1>
          <p className="att-sub">Every ticket payment — who paid, how much, and what's still owed at the venue.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="att-stats">
        {STAT_CARDS.map(c => (
          <div key={c.key} className={`att-stat ${c.cls}`}>
            <span className="att-stat-icon">{c.icon}</span>
            <div className="att-stat-body">
              <div className="att-stat-val">{c.money ? money(summary[c.key]) : (summary[c.key] ?? 0)}</div>
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
          placeholder="🔍 Search by name, email or event…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select className="att-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All payments</option>
          <option value="full">Paid in full</option>
          <option value="deposit">Deposit (balance due)</option>
        </select>
      </div>

      {/* Table */}
      <div className="att-table-wrap">
        <table className="att-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Event</th>
              <th>Price</th>
              <th>Paid</th>
              <th>Due at venue</th>
              <th>Status</th>
              <th>Paid On</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={8} className="att-empty">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="att-empty">No payments match these filters.</td></tr>
            )}
            {filtered.map(r => {
              const p = r.payment || {};
              const hasBalance = (p.balanceDue || 0) > 0;
              return (
                <tr key={r._id}>
                  <td>
                    <div className="att-name-cell">
                      <span className="att-avatar">{r.user?.name?.[0]?.toUpperCase() || '?'}</span>
                      <span>{r.user?.name || '—'}</span>
                    </div>
                  </td>
                  <td>{r.user?.email || '—'}</td>
                  <td>{r.expo?.title || '—'}</td>
                  <td>{money(p.entryFee)}</td>
                  <td>{money(p.amountPaid)}</td>
                  <td>{hasBalance ? money(p.balanceDue) : '—'}</td>
                  <td>
                    <span className={`att-badge ${hasBalance ? 'att-badge-pending' : 'att-badge-in'}`}>
                      {hasBalance ? 'Deposit' : 'Paid in full'}
                    </span>
                  </td>
                  <td>{p.paidAt ? dayjs(p.paidAt).format('MMM D, YYYY h:mm A') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
