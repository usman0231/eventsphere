import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './SessionsPage.css';

const TIERS = [
  { value: 'platinum', label: 'Platinum', color: '#d6d6e0' },
  { value: 'gold', label: 'Gold', color: '#ffd700' },
  { value: 'silver', label: 'Silver', color: '#c0c0c0' },
  { value: 'bronze', label: 'Bronze', color: '#cd7f32' },
  { value: 'startup', label: 'Startup Zone', color: '#00d4ff' },
];
const tierMeta = (t) => TIERS.find(x => x.value === t) || TIERS[1];
const blank = { name: '', tier: 'gold', logo: '', website: '', description: '', contactPerson: '', contactEmail: '', contactPhone: '' };

export default function SponsorsPage() {
  const { id: expoId } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useAuth();
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editSponsor, setEditSponsor] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSponsors(); }, [expoId]);

  const fetchSponsors = async () => {
    try {
      const { data } = await api.get(`/api/sponsors/expo/${expoId}`);
      setSponsors(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openDialog = (s = null) => {
    if (s) {
      setEditSponsor(s);
      setForm({
        name: s.name || '', tier: s.tier || 'gold', logo: s.logo || '', website: s.website || '',
        description: s.description || '', contactPerson: s.contactPerson || '',
        contactEmail: s.contactEmail || '', contactPhone: s.contactPhone || '',
      });
    } else {
      setEditSponsor(null);
      setForm(blank);
    }
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Sponsor name is required'); return; }
    setSaving(true);
    try {
      if (editSponsor) {
        await api.put(`/api/sponsors/${editSponsor._id}`, form);
        toast.success('Sponsor updated!');
      } else {
        await api.post('/api/sponsors', { expo: expoId, ...form });
        toast.success('Sponsor added!');
      }
      setDialog(false);
      fetchSponsors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving sponsor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this sponsor?')) return;
    try {
      await api.delete(`/api/sponsors/${id}`);
      toast.success('Sponsor removed');
      fetchSponsors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="sess-page">
      <div className="sess-orb sess-orb-1" />
      <div className="sess-orb sess-orb-2" />
      <div className="sess-container">
        <button className="sess-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="sess-header">
          <div>
            <p className="sess-tag">Partners</p>
            <h1 className="sess-title">Sponsors</h1>
            <p className="sess-subtitle">{sponsors.length} sponsor{sponsors.length === 1 ? '' : 's'} for this expo</p>
          </div>
          {isOrganizer && <button className="sess-add-btn" onClick={() => openDialog()}>+ Add Sponsor</button>}
        </div>

        {loading ? (
          <div className="sess-loading">Loading sponsors...</div>
        ) : sponsors.length === 0 ? (
          <div className="sess-empty">
            <span>🤝</span>
            <h3>No Sponsors Yet</h3>
            <p>{isOrganizer ? 'Add your first sponsor to showcase your partners' : 'Sponsors will appear here once added'}</p>
            {isOrganizer && <button className="sess-add-btn" onClick={() => openDialog()}>Add First Sponsor</button>}
          </div>
        ) : (
          <div className="sess-grid">
            {sponsors.map(s => {
              const meta = tierMeta(s.tier);
              return (
                <div key={s._id} className="sess-card">
                  <div className="sess-card-top">
                    <div className="sess-card-badges">
                      <span className="sess-badge-status" style={{ color: meta.color, background: `${meta.color}18`, borderColor: `${meta.color}55` }}>
                        {meta.label}
                      </span>
                    </div>
                    {isOrganizer && (
                      <div className="sess-card-actions">
                        <button className="sess-edit-btn" onClick={() => openDialog(s)}>✏️</button>
                        <button className="sess-del-btn" onClick={() => handleDelete(s._id)}>🗑️</button>
                      </div>
                    )}
                  </div>

                  {s.logo
                    ? <img src={s.logo} alt={s.name} style={{ height: 56, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '4px 0 10px' }} />
                    : <div className="sess-speaker-avatar" style={{ width: 48, height: 48, fontSize: '1.3rem', margin: '4px 0 10px' }}>{s.name?.[0]?.toUpperCase()}</div>}

                  <h3 className="sess-card-title">{s.name}</h3>
                  {s.description && <p className="sess-card-desc">{s.description}</p>}

                  <div className="sess-divider" />
                  <div className="sess-meta">
                    {s.contactPerson && <span>👤 {s.contactPerson}</span>}
                    {s.contactEmail && <span>✉️ {s.contactEmail}</span>}
                    {s.contactPhone && <span>📞 {s.contactPhone}</span>}
                  </div>
                  {s.website && (
                    <a className="sess-register-btn" href={s.website} target="_blank" rel="noreferrer" style={{ textAlign: 'center' }}>
                      Visit Website →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dialog && (
        <div className="sess-overlay" onClick={() => setDialog(false)}>
          <div className="sess-dialog" onClick={e => e.stopPropagation()}>
            <div className="sess-dialog-header">
              <h3>{editSponsor ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
              <button className="sess-dialog-close" onClick={() => setDialog(false)}>✕</button>
            </div>
            <div className="sess-dialog-body">
              <div className="sess-form-row">
                <div className="sess-form-group">
                  <label className="sess-label">Sponsor Name *</label>
                  <input className="sess-input" placeholder="Company name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="sess-form-group">
                  <label className="sess-label">Tier</label>
                  <select className="sess-input" value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}>
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Logo URL</label>
                <input className="sess-input" placeholder="https://…/logo.png" value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} />
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Website</label>
                <input className="sess-input" placeholder="https://sponsor.com" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Description</label>
                <textarea className="sess-input sess-textarea" rows={2} placeholder="What does this sponsor do?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="sess-form-row">
                <div className="sess-form-group">
                  <label className="sess-label">Contact Person</label>
                  <input className="sess-input" placeholder="Full name" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} />
                </div>
                <div className="sess-form-group">
                  <label className="sess-label">Contact Email</label>
                  <input className="sess-input" type="email" placeholder="name@sponsor.com" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Contact Phone</label>
                <input className="sess-input" placeholder="+1 555 000 0000" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="sess-dialog-footer">
              <button className="sess-cancel-btn" onClick={() => setDialog(false)}>Cancel</button>
              <button className="sess-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : (editSponsor ? 'Update Sponsor' : 'Add Sponsor')} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
