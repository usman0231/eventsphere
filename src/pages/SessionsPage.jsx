import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const statusColors = { scheduled:'#00d4ff', ongoing:'#00ff88', completed:'rgba(240,240,255,0.4)', cancelled:'#ff006e' };

export default function SessionsPage() {
  const { id: expoId } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [form, setForm] = useState({ title:'', description:'', startTime:'', endTime:'', location:'', category:'', maxAttendees:'', speakerName:'', speakerCompany:'', speakerBio:'' });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSessions(); }, [expoId]);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get(`/api/sessions/expo/${expoId}`);
      setSessions(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openDialog = (s = null) => {
    if (s) {
      setEditSession(s);
      setForm({ title:s.title, description:s.description||'', startTime:s.startTime?.slice(0,16)||'', endTime:s.endTime?.slice(0,16)||'', location:s.location||'', category:s.category||'', maxAttendees:s.maxAttendees||'', speakerName:s.speaker?.name||'', speakerCompany:s.speaker?.company||'', speakerBio:s.speaker?.bio||'' });
    } else {
      setEditSession(null);
      setForm({ title:'', description:'', startTime:'', endTime:'', location:'', category:'', maxAttendees:'', speakerName:'', speakerCompany:'', speakerBio:'' });
    }
    setDialog(true);
  };

  const handleSave = async () => {
    try {
      const payload = { expo:expoId, title:form.title, description:form.description, startTime:form.startTime, endTime:form.endTime, location:form.location, category:form.category, maxAttendees:form.maxAttendees||undefined, speaker:{ name:form.speakerName, company:form.speakerCompany, bio:form.speakerBio } };
      if (editSession) { await api.put(`/api/sessions/${editSession._id}`, payload); toast.success('Session updated!'); }
      else { await api.post('/api/sessions', payload); toast.success('Session created!'); }
      setDialog(false);
      fetchSessions();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving session'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    await api.delete(`/api/sessions/${id}`);
    toast.success('Session deleted');
    fetchSessions();
  };

  const handleRegister = async (sessionId) => {
    try {
      await api.post(`/api/sessions/${sessionId}/register`);
      toast.success('Registered for session!');
      fetchSessions();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="sess-page">
      <div className="sess-orb sess-orb-1" />
      <div className="sess-orb sess-orb-2" />
      <div className="sess-container">
        <button className="sess-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="sess-header">
          <div>
            <p className="sess-tag">Event Schedule</p>
            <h1 className="sess-title">Sessions</h1>
            <p className="sess-subtitle">{sessions.length} sessions scheduled for this expo</p>
          </div>
          {isOrganizer && <button className="sess-add-btn" onClick={() => openDialog()}>+ Add Session</button>}
        </div>

        {loading ? (
          <div className="sess-loading">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="sess-empty">
            <span>📅</span>
            <h3>No Sessions Yet</h3>
            <p>{isOrganizer ? 'Add your first session to get started' : 'Sessions will appear here once scheduled'}</p>
            {isOrganizer && <button className="sess-add-btn" onClick={() => openDialog()}>Add First Session</button>}
          </div>
        ) : (
          <div className="sess-grid">
            {sessions.map(s => (
              <div key={s._id} className="sess-card">
                <div className="sess-card-top">
                  <div className="sess-card-badges">
                    {s.category && <span className="sess-badge-cat">{s.category}</span>}
                    <span className="sess-badge-status" style={{ color:statusColors[s.status]||'#fff', background:`${statusColors[s.status]}18`, borderColor:`${statusColors[s.status]}35` }}>{s.status}</span>
                  </div>
                  {isOrganizer && (
                    <div className="sess-card-actions">
                      <button className="sess-edit-btn" onClick={() => openDialog(s)}>✏️</button>
                      <button className="sess-del-btn" onClick={() => handleDelete(s._id)}>🗑️</button>
                    </div>
                  )}
                </div>
                <h3 className="sess-card-title">{s.title}</h3>
                {s.description && <p className="sess-card-desc">{s.description}</p>}
                {s.speaker?.name && (
                  <div className="sess-speaker">
                    <div className="sess-speaker-avatar">{s.speaker.name[0]}</div>
                    <div>
                      <div className="sess-speaker-name">{s.speaker.name}</div>
                      {s.speaker.company && <div className="sess-speaker-company">{s.speaker.company}</div>}
                    </div>
                  </div>
                )}
                <div className="sess-divider" />
                <div className="sess-meta">
                  <span>🕐 {dayjs(s.startTime).format('MMM D, h:mm A')} — {dayjs(s.endTime).format('h:mm A')}</span>
                  {s.location && <span>📍 {s.location}</span>}
                  <span>👥 {s.registeredAttendees?.length || 0}{s.maxAttendees ? `/${s.maxAttendees}` : ''} registered</span>
                </div>
                <button className="sess-register-btn" onClick={() => handleRegister(s._id)}>Register for Session →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Dialog */}
      {dialog && (
        <div className="sess-overlay" onClick={() => setDialog(false)}>
          <div className="sess-dialog" onClick={e=>e.stopPropagation()}>
            <div className="sess-dialog-header">
              <h3>{editSession ? 'Edit Session' : 'Create Session'}</h3>
              <button className="sess-dialog-close" onClick={() => setDialog(false)}>✕</button>
            </div>
            <div className="sess-dialog-body">
              <div className="sess-form-group">
                <label className="sess-label">Title *</label>
                <input className="sess-input" placeholder="Session title" value={form.title} onChange={e => setForm({...form, title:e.target.value})} required />
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Description</label>
                <textarea className="sess-input sess-textarea" rows={3} placeholder="What is this session about?" value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
              </div>
              <div className="sess-form-row">
                <div className="sess-form-group">
                  <label className="sess-label">Start Time *</label>
                  <input className="sess-input" type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime:e.target.value})} required />
                </div>
                <div className="sess-form-group">
                  <label className="sess-label">End Time *</label>
                  <input className="sess-input" type="datetime-local" value={form.endTime} onChange={e => setForm({...form, endTime:e.target.value})} required />
                </div>
              </div>
              <div className="sess-form-row">
                <div className="sess-form-group">
                  <label className="sess-label">Location / Room</label>
                  <input className="sess-input" placeholder="e.g. Hall A" value={form.location} onChange={e => setForm({...form, location:e.target.value})} />
                </div>
                <div className="sess-form-group">
                  <label className="sess-label">Category</label>
                  <input className="sess-input" placeholder="e.g. Keynote" value={form.category} onChange={e => setForm({...form, category:e.target.value})} />
                </div>
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Max Attendees</label>
                <input className="sess-input" type="number" placeholder="Leave blank for unlimited" value={form.maxAttendees} onChange={e => setForm({...form, maxAttendees:e.target.value})} />
              </div>
              <div className="sess-speaker-section">Speaker Details</div>
              <div className="sess-form-row">
                <div className="sess-form-group">
                  <label className="sess-label">Speaker Name</label>
                  <input className="sess-input" placeholder="Speaker full name" value={form.speakerName} onChange={e => setForm({...form, speakerName:e.target.value})} />
                </div>
                <div className="sess-form-group">
                  <label className="sess-label">Speaker Company</label>
                  <input className="sess-input" placeholder="Company name" value={form.speakerCompany} onChange={e => setForm({...form, speakerCompany:e.target.value})} />
                </div>
              </div>
              <div className="sess-form-group">
                <label className="sess-label">Speaker Bio</label>
                <textarea className="sess-input sess-textarea" rows={2} placeholder="Brief bio..." value={form.speakerBio} onChange={e => setForm({...form, speakerBio:e.target.value})} />
              </div>
            </div>
            <div className="sess-dialog-footer">
              <button className="sess-cancel-btn" onClick={() => setDialog(false)}>Cancel</button>
              <button className="sess-save-btn" onClick={handleSave}>{editSession ? 'Update Session' : 'Create Session'} →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}