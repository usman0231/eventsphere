import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import { downloadCSV, dateStamp } from '../utils/export';
import { downloadICS, googleCalendarURL } from '../utils/calendar';
import QRTicket from '../components/QRTicket';
import ExpoReviews from '../components/ExpoReviews';
import VenueMap from '../components/VenueMap';

export default function ExpoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expo, setExpo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [exhibitors, setExhibitors] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('sessions');
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    try {
      const [expoRes, sessionsRes, exhibitorsRes, sponsorsRes] = await Promise.all([
        api.get(`/api/expos/${id}`),
        api.get(`/api/sessions/expo/${id}`),
        api.get(`/api/exhibitors/expo/${id}/public`),
        api.get(`/api/sponsors/expo/${id}`)
      ]);
      setExpo(expoRes.data.data);
      setSessions(sessionsRes.data.data);
      setExhibitors(exhibitorsRes.data.data);
      setSponsors(sponsorsRes.data.data || []);
    } catch (err) { setError('Failed to load expo details'); }
    finally { setLoading(false); }
  };

  const isMyExpo = expo?.organizer?._id === user?._id || user?.role === 'admin';

  const addExpoToCalendar = () => {
    if (!expo) return;
    const loc = [expo.location?.venue, expo.location?.city, expo.location?.country].filter(Boolean).join(', ');
    downloadICS(`${expo.title?.replace(/\s+/g, '_') || 'expo'}-${id}`, {
      id: expo._id,
      title: expo.title,
      description: expo.description,
      location: loc,
      start: expo.startDate,
      end: expo.endDate,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    toast.success('Calendar event downloaded');
  };

  const addSessionToCalendar = (s) => {
    downloadICS(`session-${s._id}`, {
      id: s._id,
      title: s.title,
      description: [s.description, s.speaker?.name ? `Speaker: ${s.speaker.name}` : null].filter(Boolean).join('\n\n'),
      location: s.location || expo?.location?.venue,
      start: s.startTime,
      end: s.endTime,
    });
  };

  const handleDeleteExpo = async () => {
    if (!window.confirm(`Delete "${expo.title}"? This will also delete all its booths. This cannot be undone.`)) return;
    try {
      await api.delete(`/api/expos/${id}`);
      toast.success('Expo deleted');
      navigate('/expos');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expo');
    }
  };

  const exportAttendees = async () => {
    try {
      const { data } = await api.get(`/api/checkin/expo/${id}`);
      const list = data.data || [];
      if (!list.length) {
        toast.info('No attendees checked in yet');
        return;
      }
      downloadCSV(`attendees-${expo?.title?.replace(/\s+/g, '_') || id}-${dateStamp()}`, list, [
        { label: 'Name', accessor: r => r.user?.name || '' },
        { label: 'Email', accessor: r => r.user?.email || '' },
        { label: 'Role', accessor: r => r.user?.role || '' },
        { label: 'Company', accessor: r => r.user?.company || '' },
        { label: 'Checked In At', accessor: r => dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss') },
        { label: 'Scanned By', accessor: r => r.scannedBy?.name || '' },
      ]);
      toast.success(`Exported ${list.length} attendees`);
    } catch (err) {
      toast.error('Failed to export attendees');
    }
  };

  const tierColor = { platinum:'#d6d6e0', gold:'#ffd700', silver:'#c0c0c0', bronze:'#cd7f32', startup:'#00d4ff' };
  const tierLabel = { platinum:'Platinum', gold:'Gold', silver:'Silver', bronze:'Bronze', startup:'Startup Zone' };

  const statusStyle = {
    published: { color:'#00d4ff', bg:'rgba(0,212,255,0.1)', border:'rgba(0,212,255,0.25)' },
    ongoing:   { color:'#00ff88', bg:'rgba(0,255,136,0.1)', border:'rgba(0,255,136,0.25)' },
    completed: { color:'rgba(240,240,255,0.4)', bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.1)' },
    draft:     { color:'#ffb300', bg:'rgba(255,179,0,0.1)', border:'rgba(255,179,0,0.25)' },
    cancelled: { color:'#ff006e', bg:'rgba(255,0,110,0.1)', border:'rgba(255,0,110,0.25)' },
  };

  if (loading) return <div className="ed-loading"><div className="ed-spinner" /></div>;
  if (error) return <div className="ed-error-msg">{error}</div>;
  if (!expo) return null;

  const s = statusStyle[expo.status] || statusStyle.draft;

  return (
    <div className="ed-page">
      <div className="ed-orb ed-orb-1" />
      <div className="ed-orb ed-orb-2" />
      <div className="ed-container">
        <button className="ed-back-btn" onClick={() => navigate('/expos')}>← Back to Expos</button>

        {/* Hero */}
        <div className="ed-hero" style={{ backgroundImage:`linear-gradient(rgba(10,10,26,0.7), rgba(10,10,26,0.95)), url(${expo.banner || `https://picsum.photos/seed/${id}/1400/500`})` }}>
          <div className="ed-hero-content">
            <span className="ed-status-badge" style={{ color:s.color, background:s.bg, borderColor:s.border }}>{expo.status}</span>
            <h1 className="ed-expo-title">{expo.title}</h1>
            <p className="ed-expo-desc">{expo.description}</p>
            <div className="ed-expo-meta-row">
              <span className="ed-meta-item">📅 {dayjs(expo.startDate).format('MMM D')} — {dayjs(expo.endDate).format('MMM D, YYYY')}</span>
              <span className="ed-meta-item">📍 {expo.location?.venue}, {expo.location?.city}, {expo.location?.country}</span>
              {expo.maxAttendees && <span className="ed-meta-item">👥 Max {expo.maxAttendees} attendees</span>}
              {expo.entryFee > 0 ? <span className="ed-meta-item">💰 ${expo.entryFee}</span> : <span className="ed-meta-item">🆓 Free Entry</span>}
            </div>
            {expo.tags?.length > 0 && (
              <div className="ed-tags">
                {expo.tags.map(tag => <span key={tag} className="ed-tag">{tag}</span>)}
              </div>
            )}
            <div className="ed-organizer-actions">
              {user && (
                <button className="ed-action-btn ed-btn-ticket" onClick={() => setShowQR(true)}>
                  🎫 Get My Ticket
                </button>
              )}
              {!user && (
                <button className="ed-action-btn ed-btn-ticket" onClick={() => navigate('/login')}>
                  🎫 Login to Get Ticket
                </button>
              )}
              <button className="ed-action-btn ed-btn-booths" onClick={addExpoToCalendar}>
                📅 Add to Calendar
              </button>
              <a
                className="ed-action-btn ed-btn-sessions"
                href={googleCalendarURL({
                  title: expo.title,
                  description: expo.description,
                  location: [expo.location?.venue, expo.location?.city].filter(Boolean).join(', '),
                  start: expo.startDate,
                  end: expo.endDate,
                })}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'inline-block' }}
              >
                🗓️ Google Calendar
              </a>
              {isMyExpo && (
                <>
                  <button className="ed-action-btn ed-btn-edit" onClick={() => navigate(`/expos/${id}/edit`)}>✏️ Edit Expo</button>
                  <button className="ed-action-btn ed-btn-booths" onClick={() => navigate(`/expos/${id}/booths`)}>🏪 Manage Booths</button>
                  <button className="ed-action-btn ed-btn-sessions" onClick={() => navigate(`/expos/${id}/sessions`)}>📅 Manage Sessions</button>
                  <button className="ed-action-btn ed-btn-booths" onClick={() => navigate(`/expos/${id}/sponsors`)}>🤝 Manage Sponsors</button>
                  <button className="ed-action-btn ed-btn-edit" onClick={exportAttendees}>📋 Export Attendees CSV</button>
                  <button className="ed-action-btn ed-btn-delete" onClick={handleDeleteExpo}>🗑️ Delete Expo</button>
                </>
              )}
            </div>
            {expo.organizer && (
              <div className="ed-organizer-info">
                <div className="ed-org-avatar">{expo.organizer.name?.[0]?.toUpperCase()}</div>
                <div>
                  <div className="ed-org-label">Organized by</div>
                  <div className="ed-org-name">{expo.organizer.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="ed-tabs">
          <button className={`ed-tab ${tab==='sessions'?'active':''}`} onClick={() => setTab('sessions')}>📅 Sessions ({sessions.length})</button>
          <button className={`ed-tab ${tab==='exhibitors'?'active':''}`} onClick={() => setTab('exhibitors')}>🏪 Exhibitors ({exhibitors.length})</button>
          {sponsors.length > 0 && <button className={`ed-tab ${tab==='sponsors'?'active':''}`} onClick={() => setTab('sponsors')}>🤝 Sponsors ({sponsors.length})</button>}
          <button className={`ed-tab ${tab==='reviews'?'active':''}`} onClick={() => setTab('reviews')}>⭐ Reviews</button>
          <button className={`ed-tab ${tab==='details'?'active':''}`} onClick={() => setTab('details')}>ℹ️ Details</button>
        </div>

        {tab === 'reviews' && <ExpoReviews expoId={id} />}

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          sessions.length === 0 ? (
            <div className="ed-empty"><span>📅</span><p>No sessions scheduled yet</p></div>
          ) : (
            <div className="ed-sessions-grid">
              {sessions.map(session => (
                <div key={session._id} className="ed-session-card">
                  <div className="ed-session-header">
                    {session.category && <span className="ed-sess-badge">{session.category}</span>}
                    <span className="ed-sess-status">{session.status}</span>
                  </div>
                  <h4 className="ed-sess-title">{session.title}</h4>
                  {session.description && <p className="ed-sess-desc">{session.description}</p>}
                  {session.speaker?.name && (
                    <div className="ed-sess-speaker">
                      <div className="ed-sess-spk-avatar">{session.speaker.name[0]}</div>
                      <div>
                        <div className="ed-sess-spk-name">{session.speaker.name}</div>
                        {session.speaker.company && <div className="ed-sess-spk-company">{session.speaker.company}</div>}
                      </div>
                    </div>
                  )}
                  <div className="ed-sess-meta">
                    <span>🕐 {dayjs(session.startTime).format('MMM D, h:mm A')}</span>
                    {session.location && <span>📍 {session.location}</span>}
                  </div>
                  <button
                    className="ed-sess-cal-btn"
                    onClick={e => { e.stopPropagation(); addSessionToCalendar(session); }}
                  >
                    📅 Add to Calendar
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Exhibitors Tab */}
        {tab === 'exhibitors' && (
          exhibitors.length === 0 ? (
            <div className="ed-empty"><span>🏪</span><p>No confirmed exhibitors yet</p></div>
          ) : (
            <div className="ed-exhibitors-grid">
              {exhibitors.map(ex => (
                <div key={ex._id} className="ed-exhibitor-card">
                  <div className="ed-ex-avatar">{ex.companyName?.[0]}</div>
                  <div className="ed-ex-info">
                    <div className="ed-ex-name">{ex.companyName}</div>
                    {ex.category && <div className="ed-ex-cat">{ex.category}</div>}
                    {ex.assignedBooth && <div className="ed-ex-booth">Booth {ex.assignedBooth.boothNumber}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Sponsors Tab */}
        {tab === 'sponsors' && (
          sponsors.length === 0 ? (
            <div className="ed-empty"><span>🤝</span><p>No sponsors yet</p></div>
          ) : (
            <div className="ed-exhibitors-grid">
              {sponsors.map(sp => (
                <div key={sp._id} className="ed-exhibitor-card">
                  {sp.logo
                    ? <img src={sp.logo} alt={sp.name} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8 }} />
                    : <div className="ed-ex-avatar">{sp.name?.[0]?.toUpperCase()}</div>}
                  <div className="ed-ex-info">
                    <div className="ed-ex-name">
                      {sp.website
                        ? <a href={sp.website} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{sp.name}</a>
                        : sp.name}
                    </div>
                    <div className="ed-ex-cat" style={{ color: tierColor[sp.tier] || '#ffd700' }}>{tierLabel[sp.tier] || 'Sponsor'}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Details Tab */}
        {tab === 'details' && (
          <div className="ed-details-grid">
            <div className="ed-details-card">
              <h4 className="ed-details-title">Event Information</h4>
              {[['Theme', expo.theme], ['Category', expo.category], ['Total Booths', expo.totalBooths], ['Registration Deadline', expo.registrationDeadline ? dayjs(expo.registrationDeadline).format('MMM D, YYYY') : null]].filter(([,v])=>v).map(([k,v]) => (
                <div key={k} className="ed-detail-row">
                  <span className="ed-detail-key">{k}</span>
                  <span className="ed-detail-val">{v}</span>
                </div>
              ))}
            </div>
            <div className="ed-details-card">
              <h4 className="ed-details-title">Location</h4>
              <p className="ed-location-venue">{expo.location?.venue}</p>
              {expo.location?.address && <p className="ed-location-sub">{expo.location.address}</p>}
              <p className="ed-location-sub">{expo.location?.city}, {expo.location?.country}</p>
              {expo.location?.coordinates?.lat != null && expo.location?.coordinates?.lng != null && (
                <div style={{ marginTop: 14 }}>
                  <VenueMap
                    lat={expo.location.coordinates.lat}
                    lng={expo.location.coordinates.lng}
                    venue={expo.location.venue}
                    address={expo.location.address}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {showQR && <QRTicket user={user} expo={expo} onClose={() => setShowQR(false)} />}
    </div>
  );
}