import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import './ExhibitorPortalPage.css';

export default function ExhibitorPortalPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ expo:'', companyName:'', companyDescription:'', website:'', category:'', boothPreference:'medium', products:'' });
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [appsRes, exposRes] = await Promise.all([api.get('/api/exhibitors/my'), api.get('/api/expos')]);
      setApplications(appsRes.data.data);
      setExpos(exposRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApply = async () => {
    setError('');
    try {
      await api.post('/api/exhibitors', { ...form, products: form.products.split(',').map(p => p.trim()).filter(Boolean) });
      toast.success('Application submitted successfully!');
      setDialog(false);
      setForm({ expo:'', companyName:'', companyDescription:'', website:'', category:'', boothPreference:'medium', products:'' });
      fetchData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to submit'); }
  };

  const statusStyle = {
    approved: { bg:'rgba(0,255,136,0.1)', color:'#00ff88', border:'rgba(0,255,136,0.3)' },
    rejected: { bg:'rgba(255,0,110,0.1)', color:'#ff80ab', border:'rgba(255,0,110,0.3)' },
    pending:  { bg:'rgba(255,179,0,0.1)', color:'#ffb300', border:'rgba(255,179,0,0.3)' },
  };

  return (
    <div className="ep-page">
      <div className="ep-orb ep-orb-1" />
      <div className="ep-orb ep-orb-2" />
      <div className="ep-container">
        <div className="ep-header">
          <div>
            <p className="ep-tag">Exhibitor Portal</p>
            <h1 className="ep-title">My Applications</h1>
            <p className="ep-subtitle">Manage your expo applications and booth reservations</p>
          </div>
          <button className="ep-apply-btn" onClick={() => setDialog(true)}>+ Apply for Expo</button>
        </div>

        {loading ? (
          <div className="ep-loading">Loading your applications...</div>
        ) : applications.length === 0 ? (
          <div className="ep-empty">
            <span className="ep-empty-icon">🏪</span>
            <h3>No Applications Yet</h3>
            <p>Apply for an expo to start showcasing your products and services to thousands of attendees</p>
            <button className="ep-apply-btn" onClick={() => setDialog(true)}>Apply Now →</button>
          </div>
        ) : (
          <div className="ep-grid">
            {applications.map(app => {
              const s = statusStyle[app.status] || statusStyle.pending;
              return (
                <div key={app._id} className="ep-card">
                  <div className="ep-card-top">
                    <h3 className="ep-card-company">{app.companyName}</h3>
                    <span className="ep-status" style={{ background:s.bg, color:s.color, borderColor:s.border }}>{app.status}</span>
                  </div>
                  <p className="ep-card-expo">🎪 {app.expo?.title}</p>
                  <p className="ep-card-meta">📅 {dayjs(app.expo?.startDate).format('MMM D, YYYY')}</p>
                  <p className="ep-card-meta">📍 {app.expo?.location?.venue}</p>
                  {app.category && <p className="ep-card-meta">🏷️ {app.category}</p>}
                  {app.assignedBooth && (
                    <div className="ep-booth-badge">🏪 Assigned Booth: {app.assignedBooth.boothNumber}</div>
                  )}
                  {app.rejectionReason && (
                    <div className="ep-rejection">❌ {app.rejectionReason}</div>
                  )}
                  {app.products?.length > 0 && (
                    <div className="ep-products">
                      {app.products.map(p => <span key={p} className="ep-product-tag">{p}</span>)}
                    </div>
                  )}
                  <button className="ep-view-btn" onClick={() => navigate(`/expos/${app.expo?._id}`)}>View Expo →</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* APPLY DIALOG */}
      {dialog && (
        <div className="ep-overlay" onClick={() => setDialog(false)}>
          <div className="ep-dialog" onClick={e => e.stopPropagation()}>
            <div className="ep-dialog-header">
              <h3>Apply for Expo</h3>
              <button className="ep-dialog-close" onClick={() => setDialog(false)}>✕</button>
            </div>
            <div className="ep-dialog-body">
              {error && <div className="ep-dialog-error">{error}</div>}
              <div className="ep-form-group">
                <label className="ep-label">Select Expo *</label>
                <select className="ep-input" value={form.expo} onChange={e => setForm({...form, expo: e.target.value})} required>
                  <option value="">Choose an expo...</option>
                  {expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
                </select>
              </div>
              <div className="ep-form-row">
                <div className="ep-form-group">
                  <label className="ep-label">Company Name *</label>
                  <input className="ep-input" placeholder="Your company name" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} required />
                </div>
                <div className="ep-form-group">
                  <label className="ep-label">Category</label>
                  <input className="ep-input" placeholder="e.g. Technology" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
              </div>
              <div className="ep-form-group">
                <label className="ep-label">Company Description</label>
                <textarea className="ep-input ep-textarea" rows={3} placeholder="Brief description of your company..." value={form.companyDescription} onChange={e => setForm({...form, companyDescription: e.target.value})} />
              </div>
              <div className="ep-form-row">
                <div className="ep-form-group">
                  <label className="ep-label">Website</label>
                  <input className="ep-input" placeholder="https://yoursite.com" value={form.website} onChange={e => setForm({...form, website: e.target.value})} />
                </div>
                <div className="ep-form-group">
                  <label className="ep-label">Booth Preference</label>
                  <select className="ep-input" value={form.boothPreference} onChange={e => setForm({...form, boothPreference: e.target.value})}>
                    {['small','medium','large','extra-large'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="ep-form-group">
                <label className="ep-label">Products/Services (comma-separated)</label>
                <input className="ep-input" placeholder="Product A, Service B, Product C" value={form.products} onChange={e => setForm({...form, products: e.target.value})} />
              </div>
            </div>
            <div className="ep-dialog-footer">
              <button className="ep-cancel-btn" onClick={() => setDialog(false)}>Cancel</button>
              <button className="ep-submit-btn" onClick={handleApply}>Submit Application →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}