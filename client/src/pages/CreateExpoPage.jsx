import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './CreateExpoPage.css';

const STATUS_OPTIONS = ['draft','published','ongoing','completed','cancelled'];
const CATEGORY_OPTIONS = ['Technology','Health','Education','Business','Art','Science','Food','Fashion','Other'];

export default function CreateExpoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title:'', description:'', theme:'', category:'', startDate:'', endDate:'',
    venue:'', address:'', city:'', country:'', lat:'', lng:'',
    maxAttendees:'', entryFee:0, totalBooths:20, status:'draft', tags:'', registrationDeadline:'',
    floorPlan:'', banner:''
  });
  const [initialForm, setInitialForm] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isEdit) fetchExpo(); }, [id]);

  const fetchExpo = async () => {
    try {
      const { data } = await api.get(`/api/expos/${id}`);
      const e = data.data;
      const loaded = {
        title:e.title||'', description:e.description||'', theme:e.theme||'', category:e.category||'',
        startDate:e.startDate?e.startDate.split('T')[0]:'',
        endDate:e.endDate?e.endDate.split('T')[0]:'',
        registrationDeadline:e.registrationDeadline?e.registrationDeadline.split('T')[0]:'',
        venue:e.location?.venue||'', address:e.location?.address||'',
        city:e.location?.city||'', country:e.location?.country||'',
        lat:e.location?.coordinates?.lat ?? '', lng:e.location?.coordinates?.lng ?? '',
        maxAttendees:e.maxAttendees||'', entryFee:e.entryFee||0,
        totalBooths:e.totalBooths||20, status:e.status||'draft',
        tags:e.tags?.join(', ')||'',
        floorPlan:e.floorPlan||'', banner:e.banner||''
      };
      setForm(loaded);
      setInitialForm(loaded);
    } catch { setError('Failed to load expo'); }
  };

  const handleChange = e => setForm({...form, [e.target.name]: e.target.value});

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setUploadingBanner(true);
    try {
      const res = await api.post('/api/upload/image', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(f => ({ ...f, banner: res.data.data.url }));
      toast.success('Banner uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingBanner(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const payload = {
        title:form.title, description:form.description, theme:form.theme, category:form.category,
        startDate:form.startDate, endDate:form.endDate, status:form.status,
        entryFee:Number(form.entryFee), totalBooths:Number(form.totalBooths),
        maxAttendees:form.maxAttendees?Number(form.maxAttendees):undefined,
        registrationDeadline:form.registrationDeadline||undefined,
        location:{
          venue:form.venue, address:form.address, city:form.city, country:form.country,
          coordinates: (form.lat !== '' && form.lng !== '') ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined,
        },
        tags:form.tags?form.tags.split(',').map(t=>t.trim()).filter(Boolean):[],
        floorPlan:form.floorPlan||undefined,
        banner:form.banner||undefined
      };
      if (isEdit) {
        await api.put(`/api/expos/${id}`, payload);
        toast.success('Expo updated!');
        navigate(`/expos/${id}`);
      } else {
        const { data } = await api.post('/api/expos', payload);
        toast.success('Expo created!');
        navigate(`/expos/${data.data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expo');
    } finally { setLoading(false); }
  };

  return (
    <div className="ce-page">
      <div className="ce-orb ce-orb-1" />
      <div className="ce-orb ce-orb-2" />
      <div className="ce-container">
        <button className="ce-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="ce-header">
          <p className="ce-tag">{isEdit ? 'Update Expo' : 'New Expo'}</p>
          <h1 className="ce-title">{isEdit ? 'Edit Expo' : 'Create New Expo'}</h1>
          <p className="ce-subtitle">{isEdit ? 'Update your expo details below' : 'Fill in the details to create your expo'}</p>
        </div>
        {error && <div className="ce-error">{error}</div>}
        <form onSubmit={handleSubmit} className="ce-form">
          <div className="ce-grid">
            <div className="ce-main">
              {/* Basic Info */}
              <div className="ce-card">
                <h3 className="ce-card-title">Basic Information</h3>
                <div className="ce-form-group">
                  <label className="ce-label">Expo Title *</label>
                  <input className="ce-input" name="title" placeholder="e.g. Tech Innovation Expo 2026" value={form.title} onChange={handleChange} required />
                </div>
                <div className="ce-form-group">
                  <label className="ce-label">Description *</label>
                  <textarea className="ce-input ce-textarea" name="description" rows={5} placeholder="Describe your expo..." value={form.description} onChange={handleChange} required />
                </div>
                <div className="ce-form-row">
                  <div className="ce-form-group">
                    <label className="ce-label">Theme</label>
                    <input className="ce-input" name="theme" placeholder="e.g. Future of Technology" value={form.theme} onChange={handleChange} />
                  </div>
                  <div className="ce-form-group">
                    <label className="ce-label">Category</label>
                    <select className="ce-input" name="category" value={form.category} onChange={handleChange}>
                      <option value="">Select category...</option>
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ce-form-row">
                  <div className="ce-form-group">
                    <label className="ce-label">Start Date *</label>
                    <input className="ce-input" type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
                  </div>
                  <div className="ce-form-group">
                    <label className="ce-label">End Date *</label>
                    <input className="ce-input" type="date" name="endDate" value={form.endDate} onChange={handleChange} required />
                  </div>
                </div>
                <div className="ce-form-row">
                  <div className="ce-form-group">
                    <label className="ce-label">Registration Deadline</label>
                    <input className="ce-input" type="date" name="registrationDeadline" value={form.registrationDeadline} onChange={handleChange} />
                  </div>
                  <div className="ce-form-group">
                    <label className="ce-label">Tags (comma-separated)</label>
                    <input className="ce-input" name="tags" placeholder="tech, innovation, startup" value={form.tags} onChange={handleChange} />
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="ce-card">
                <h3 className="ce-card-title">🖼️ Media (optional)</h3>
                <div className="ce-form-group">
                  <label className="ce-label">Banner Image</label>
                  <div className="ce-upload-row">
                    <label className="ce-upload-btn">
                      {uploadingBanner ? 'Uploading…' : '📤 Upload Image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleBannerUpload}
                        disabled={uploadingBanner}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <span className="ce-upload-hint">or paste a URL ↓</span>
                  </div>
                  <input className="ce-input" name="banner" placeholder="https://.../banner.jpg" value={form.banner} onChange={handleChange} />
                  {form.banner && (
                    <div className="ce-upload-preview">
                      <img src={form.banner} alt="Banner preview" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <button type="button" className="ce-upload-clear" onClick={() => setForm(f => ({ ...f, banner: '' }))}>Remove</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="ce-card">
                <h3 className="ce-card-title">📍 Location</h3>
                <div className="ce-form-group">
                  <label className="ce-label">Venue Name *</label>
                  <input className="ce-input" name="venue" placeholder="e.g. Convention Center" value={form.venue} onChange={handleChange} required />
                </div>
                <div className="ce-form-group">
                  <label className="ce-label">Street Address</label>
                  <input className="ce-input" name="address" placeholder="123 Main Street" value={form.address} onChange={handleChange} />
                </div>
                <div className="ce-form-row">
                  <div className="ce-form-group">
                    <label className="ce-label">City</label>
                    <input className="ce-input" name="city" placeholder="New York" value={form.city} onChange={handleChange} />
                  </div>
                  <div className="ce-form-group">
                    <label className="ce-label">Country</label>
                    <input className="ce-input" name="country" placeholder="United States" value={form.country} onChange={handleChange} />
                  </div>
                </div>
                <div className="ce-form-row">
                  <div className="ce-form-group">
                    <label className="ce-label">Latitude (optional)</label>
                    <input className="ce-input" type="number" step="any" name="lat" placeholder="40.7128" value={form.lat} onChange={handleChange} />
                  </div>
                  <div className="ce-form-group">
                    <label className="ce-label">Longitude (optional)</label>
                    <input className="ce-input" type="number" step="any" name="lng" placeholder="-74.0060" value={form.lng} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="ce-sidebar">
              <div className="ce-card">
                <h3 className="ce-card-title">⚙️ Settings</h3>
                <div className="ce-form-group">
                  <label className="ce-label">Status</label>
                  <select className="ce-input" name="status" value={form.status} onChange={handleChange}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="ce-form-group">
                  <label className="ce-label">Max Attendees</label>
                  <input className="ce-input" type="number" name="maxAttendees" placeholder="Leave blank for unlimited" value={form.maxAttendees} onChange={handleChange} />
                </div>
                <div className="ce-form-group">
                  <label className="ce-label">Entry Fee ($)</label>
                  <input className="ce-input" type="number" name="entryFee" value={form.entryFee} onChange={handleChange} />
                </div>
                <div className="ce-form-group">
                  <label className="ce-label">Total Booths</label>
                  <input className="ce-input" type="number" name="totalBooths" value={form.totalBooths} onChange={handleChange} />
                </div>
              </div>
              <button
                className="ce-submit-btn"
                type="submit"
                disabled={loading || (isEdit && initialForm && JSON.stringify(form) === JSON.stringify(initialForm))}
              >
                {loading ? <span className="ce-spinner" /> : isEdit ? '💾 Update Expo' : '🚀 Create Expo'}
              </button>
              <button type="button" className="ce-cancel-btn" onClick={() => navigate(-1)}>Cancel</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}