import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler,
} from 'chart.js';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
// Styles live in src/global.css (imported by pages/_app.jsx) — Next.js forbids
// importing global CSS from a non-_app file, so we @import it there instead.

dayjs.extend(relativeTime);
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

// ── Constants ───────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',     icon: '📊', label: 'Overview' },
  { key: 'expos',        icon: '🎪', label: 'My Expos' },
  { key: 'applications', icon: '📋', label: 'Applications' },
  { key: 'booths',       icon: '🏪', label: 'Booth Management' },
  { key: 'sessions',     icon: '📅', label: 'Sessions' },
  { key: 'analytics',    icon: '📈', label: 'Analytics' },
  { key: 'messages',     icon: '💬', label: 'Messages' },
  { key: 'feedback',     icon: '⭐', label: 'Feedback' },
  { key: 'settings',     icon: '⚙️', label: 'Settings' },
];

const APP_STATUS = {
  approved: { bg: 'rgba(0,255,136,0.12)', color: '#00ff88', border: 'rgba(0,255,136,0.3)', label: 'Approved' },
  rejected: { bg: 'rgba(255,0,110,0.12)', color: '#ff80ab', border: 'rgba(255,0,110,0.3)', label: 'Rejected' },
  pending:  { bg: 'rgba(255,179,0,0.12)', color: '#ffb300', border: 'rgba(255,179,0,0.3)', label: 'Pending' },
};
const EXPO_STATUS = {
  draft:     { color: 'rgba(240,240,255,0.6)', label: 'Draft' },
  published: { color: '#00d4ff', label: 'Published' },
  ongoing:   { color: '#00ff88', label: 'Ongoing' },
  completed: { color: '#7b2ff7', label: 'Completed' },
  cancelled: { color: '#ff80ab', label: 'Cancelled' },
};
const BOOTH_COLOR = { available: '#00ff88', reserved: '#ffb300', occupied: '#7b2ff7' };
const FB_TYPE_ICON = { suggestion: '💡', bug: '🐞', complaint: '⚠️', compliment: '💚' };
const FB_STATUS = { open: '#ffb300', 'in-progress': '#00d4ff', resolved: '#00ff88' };
const SESSION_CATS = ['Keynote', 'Workshop', 'Panel', 'Demo', 'Networking'];
const DEFAULT_PREFS = { applicationUpdates: true, newMessages: true, expoAnnouncements: true };

// ── Helpers ───────────────────────────────────────────────────────────────--
function CountUp({ value }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    cancelAnimationFrame(ref.current);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 900);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <>{n}</>;
}
const Skel = ({ w = '100%', h = 16, r = 8, style }) => <span className="od-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
const ago = (d) => { const v = dayjs(d); return v.isValid() ? v.fromNow() : ''; };
const fmtDate = (d) => { const v = dayjs(d); return v.isValid() ? v.format('MMM D, YYYY') : '—'; };
const toLocalInput = (d) => { const v = dayjs(d); return v.isValid() ? v.format('YYYY-MM-DDTHH:mm') : ''; };

export default function OrganizerDashboard() {
  const { user, logout, updateProfile } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [notifPanel, setNotifPanel] = useState(false);

  // Data
  const [analytics, setAnalytics] = useState(null);
  const [expos, setExpos] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [activity, setActivity] = useState([]);
  const [boothsByExpo, setBoothsByExpo] = useState({});
  const [sessionsByExpo, setSessionsByExpo] = useState({});
  const [appsByExpo, setAppsByExpo] = useState({});

  // Expos tab
  const [expoFilter, setExpoFilter] = useState('all');
  const [expoSearch, setExpoSearch] = useState('');

  // Applications tab
  const [appExpoFilter, setAppExpoFilter] = useState('all');
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [appSearch, setAppSearch] = useState('');
  const [approveModal, setApproveModal] = useState(null); // application
  const [approveBooth, setApproveBooth] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Booth tab
  const [boothExpo, setBoothExpo] = useState('');
  const [boothView, setBoothView] = useState('grid');
  const [boothModal, setBoothModal] = useState(null);
  const [boothStatusEdit, setBoothStatusEdit] = useState('');

  // Sessions tab
  const [sessExpo, setSessExpo] = useState('');
  const [sessModal, setSessModal] = useState(null); // {mode, data}
  const [sessForm, setSessForm] = useState(null);
  const [sessBusy, setSessBusy] = useState(false);

  // Analytics tab
  const [anExpo, setAnExpo] = useState('all');
  const [expoAnalytics, setExpoAnalytics] = useState(null);

  // Messages tab
  const [msgView, setMsgView] = useState('inbox');
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({ recipient: '', subject: '', content: '' });
  const [composeBusy, setComposeBusy] = useState(false);

  // Feedback tab
  const [fbType, setFbType] = useState('all');
  const [fbStatus, setFbStatus] = useState('all');
  const [fbExpo, setFbExpo] = useState('all');
  const [fbRating, setFbRating] = useState('all');

  // Settings tab
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', company: '', bio: '' });
  const [profileBusy, setProfileBusy] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────--
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [anRes, expoRes, inboxRes, sentRes, notifRes, fbRes, actRes] = await Promise.all([
        api.get('/api/analytics/dashboard').catch(() => ({ data: { data: null } })),
        api.get('/api/expos/my/organized'),
        api.get('/api/messages/inbox').catch(() => ({ data: { data: [] } })),
        api.get('/api/messages/sent').catch(() => ({ data: { data: [] } })),
        api.get('/api/notifications').catch(() => ({ data: { data: [] } })),
        api.get('/api/feedback').catch(() => ({ data: { data: [] } })),
        api.get('/api/activity?limit=20').catch(() => ({ data: { data: [] } })),
      ]);
      const myExpos = expoRes.data.data || [];
      setAnalytics(anRes.data.data);
      setExpos(myExpos);
      setInbox(inboxRes.data.data || []);
      setSent(sentRes.data.data || []);
      setNotifications(notifRes.data.data || []);
      setFeedback(fbRes.data.data || []);
      setActivity(actRes.data.data || []);

      // Per-expo booths / sessions / applications (cached maps).
      const booths = {}, sess = {}, apps = {};
      await Promise.all(myExpos.map(async (e) => {
        const [b, s, a] = await Promise.all([
          api.get(`/api/booths/expo/${e._id}`).then(r => r.data.data || []).catch(() => []),
          api.get(`/api/sessions/expo/${e._id}`).then(r => r.data.data || []).catch(() => []),
          api.get(`/api/exhibitors/expo/${e._id}`).then(r => r.data.data || []).catch(() => []),
        ]);
        booths[e._id] = b; sess[e._id] = s; apps[e._id] = a;
      }));
      setBoothsByExpo(booths); setSessionsByExpo(sess); setAppsByExpo(apps);
      setBoothExpo(prev => prev || myExpos[0]?._id || '');
      setSessExpo(prev => prev || myExpos[0]?._id || '');
    } catch {
      if (!silent) toast.error('Could not load your dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!socket) return;
    const onNotif = (n) => {
      setNotifications(prev => [n, ...prev]);
      if (n.type === 'application_received') toast.info('📋 New exhibitor application received');
      fetchAll(true);
    };
    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [socket, fetchAll]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({ name: user.name || '', phone: user.phone || '', company: user.company || '', bio: user.bio || '' });
    setPrefs({ ...DEFAULT_PREFS, ...(user.notificationPrefs || {}) });
  }, [user]);

  // Load per-expo analytics when a specific expo is selected on the analytics tab.
  useEffect(() => {
    if (tab !== 'analytics' || anExpo === 'all') { setExpoAnalytics(null); return; }
    let active = true;
    api.get(`/api/analytics/expo/${anExpo}`).then(r => { if (active) setExpoAnalytics(r.data.data); }).catch(() => setExpoAnalytics(null));
    return () => { active = false; };
  }, [tab, anExpo]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const allApplications = useMemo(() =>
    Object.entries(appsByExpo).flatMap(([expoId, list]) => {
      const expo = expos.find(e => e._id === expoId);
      return (list || []).map(a => ({ ...a, _expo: expo }));
    }), [appsByExpo, expos]);

  const pendingApps = useMemo(() => allApplications.filter(a => a.status === 'pending'), [allApplications]);
  const totalSessions = useMemo(() => Object.values(sessionsByExpo).reduce((n, s) => n + (s?.length || 0), 0), [sessionsByExpo]);
  const totalBooths = useMemo(() => Object.values(boothsByExpo).reduce((n, b) => n + (b?.length || 0), 0), [boothsByExpo]);
  const unreadCount = useMemo(() => inbox.filter(m => !m.isRead).length, [inbox]);

  const expoCounts = useCallback((expoId) => {
    const b = boothsByExpo[expoId] || [];
    return {
      booths: b.length,
      sessions: (sessionsByExpo[expoId] || []).length,
      applications: (appsByExpo[expoId] || []).length,
      occupied: b.filter(x => x.status === 'occupied').length,
    };
  }, [boothsByExpo, sessionsByExpo, appsByExpo]);

  // ── Actions ─────────────────────────────────────────────────────────────--
  const go = (t) => { setTab(t); setSidebarOpen(false); setNotifPanel(false); };
  const handleLogout = () => { logout(); navigate('/login'); };

  const deleteExpo = async (e) => {
    if (!window.confirm(`Delete "${e.title}"? This permanently removes its booths, sessions, applications and registrations.`)) return;
    try {
      await api.delete(`/api/expos/${e._id}`);
      toast.success('Expo deleted');
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete expo'); }
  };

  const doApprove = async () => {
    if (!approveModal) return;
    setActionBusy(true);
    try {
      await api.put(`/api/exhibitors/${approveModal._id}/status`, { status: 'approved', boothId: approveBooth || undefined });
      toast.success('Application approved');
      setApproveModal(null); setApproveBooth('');
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not approve'); } finally { setActionBusy(false); }
  };
  const doReject = async () => {
    if (!rejectModal) return;
    setActionBusy(true);
    try {
      await api.put(`/api/exhibitors/${rejectModal._id}/status`, { status: 'rejected', rejectionReason: rejectReason });
      toast.success('Application rejected');
      setRejectModal(null); setRejectReason('');
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not reject'); } finally { setActionBusy(false); }
  };

  const saveBoothStatus = async () => {
    if (!boothModal) return;
    try {
      await api.put(`/api/booths/${boothModal._id}`, { status: boothStatusEdit });
      toast.success('Booth updated');
      setBoothModal(null);
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not update booth'); }
  };
  const releaseBooth = async () => {
    if (!boothModal) return;
    if (!window.confirm(`Release booth ${boothModal.boothNumber}? It becomes available again.`)) return;
    try {
      await api.delete(`/api/booths/${boothModal._id}/release`);
      toast.success('Booth released');
      setBoothModal(null);
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not release booth'); }
  };

  const exportBooths = () => {
    const list = boothsByExpo[boothExpo] || [];
    const rows = [['Booth', 'Size', 'Status', 'Price', 'Exhibitor'], ...list.map(b => [b.boothNumber, b.size, b.status, b.price || 0, b.exhibitor?.name || b.exhibitor?.company || ''])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `booths-${boothExpo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openSessForm = (mode, data) => {
    setSessModal({ mode });
    setSessForm(mode === 'edit' ? {
      title: data.title || '', description: data.description || '',
      startTime: toLocalInput(data.startTime), endTime: toLocalInput(data.endTime),
      location: data.location || '', category: data.category || '', maxAttendees: data.maxAttendees || '',
      speakerName: data.speaker?.name || '', speakerCompany: data.speaker?.company || '', speakerBio: data.speaker?.bio || '',
      _id: data._id,
    } : { title: '', description: '', startTime: '', endTime: '', location: '', category: '', maxAttendees: '', speakerName: '', speakerCompany: '', speakerBio: '' });
  };
  const saveSession = async () => {
    if (!sessForm.title.trim()) return toast.error('Title is required');
    if (!sessForm.startTime || !sessForm.endTime) return toast.error('Start and end time are required');
    setSessBusy(true);
    const payload = {
      expo: sessExpo, title: sessForm.title, description: sessForm.description,
      startTime: sessForm.startTime, endTime: sessForm.endTime, location: sessForm.location,
      category: sessForm.category, maxAttendees: sessForm.maxAttendees ? Number(sessForm.maxAttendees) : undefined,
      speaker: { name: sessForm.speakerName, company: sessForm.speakerCompany, bio: sessForm.speakerBio },
    };
    try {
      if (sessModal.mode === 'edit') await api.put(`/api/sessions/${sessForm._id}`, payload);
      else await api.post('/api/sessions', payload);
      toast.success(sessModal.mode === 'edit' ? 'Session updated' : 'Session created');
      setSessModal(null); setSessForm(null);
      fetchAll(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save session'); } finally { setSessBusy(false); }
  };
  const deleteSession = async (s) => {
    if (!window.confirm(`Delete session "${s.title}"?`)) return;
    try { await api.delete(`/api/sessions/${s._id}`); toast.success('Session deleted'); fetchAll(true); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not delete session'); }
  };

  // Messages
  const recipients = useMemo(() => {
    const map = {};
    allApplications.forEach(a => { if (a.user?._id) map[a.user._id] = a.user.name || a.companyName; });
    return Object.entries(map).map(([_id, name]) => ({ _id, name }));
  }, [allApplications]);

  const openMessage = async (m) => {
    setSelectedMsg(m); setReplyText('');
    if (!m.isRead && msgView === 'inbox') {
      try { await api.put(`/api/messages/${m._id}/read`); setInbox(prev => prev.map(x => x._id === m._id ? { ...x, isRead: true } : x)); } catch { /* ignore */ }
    }
  };
  const sendReply = async () => {
    if (!replyText.trim() || !selectedMsg) return;
    setReplyBusy(true);
    try {
      await api.post('/api/messages', { recipient: selectedMsg.sender?._id || selectedMsg.sender, subject: selectedMsg.subject ? `Re: ${selectedMsg.subject}` : 'Reply', content: replyText });
      toast.success('Reply sent'); setReplyText('');
      const r = await api.get('/api/messages/sent'); setSent(r.data.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not send reply'); } finally { setReplyBusy(false); }
  };
  const submitCompose = async () => {
    if (!composeForm.recipient) return toast.error('Choose a recipient');
    if (!composeForm.content.trim()) return toast.error('Write a message');
    setComposeBusy(true);
    try {
      await api.post('/api/messages', composeForm);
      toast.success('Message sent'); setComposeOpen(false);
      const r = await api.get('/api/messages/sent'); setSent(r.data.data || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not send message'); } finally { setComposeBusy(false); }
  };
  const deleteMessage = async (id) => {
    try {
      await api.delete(`/api/messages/${id}`);
      setInbox(prev => prev.filter(m => m._id !== id)); setSent(prev => prev.filter(m => m._id !== id));
      setSelectedMsg(null); toast.success('Message deleted');
    } catch { toast.error('Could not delete message'); }
  };
  const markAllRead = async () => {
    try { await api.put('/api/notifications/read-all').catch(() => {}); } catch { /* ignore */ }
    await Promise.all(inbox.filter(m => !m.isRead).map(m => api.put(`/api/messages/${m._id}/read`).catch(() => {})));
    setInbox(prev => prev.map(m => ({ ...m, isRead: true })));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Feedback
  const cycleFeedback = async (f) => {
    const next = { open: 'in-progress', 'in-progress': 'resolved', resolved: 'open' }[f.status];
    try {
      await api.put(`/api/feedback/${f._id}`, { status: next });
      setFeedback(prev => prev.map(x => x._id === f._id ? { ...x, status: next } : x));
      toast.success(`Marked ${next}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not update feedback'); }
  };

  // Settings
  const saveProfile = async () => {
    setProfileBusy(true);
    try { await updateProfile(profileForm); toast.success('Profile saved'); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not save profile'); } finally { setProfileBusy(false); }
  };
  const savePrefs = async () => {
    setPrefsBusy(true);
    try { await updateProfile({ notificationPrefs: prefs }); toast.success('Preferences saved'); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not save preferences'); } finally { setPrefsBusy(false); }
  };
  const changePassword = async () => {
    if (pwForm.newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    setPwBusy(true);
    try {
      await api.put('/api/auth/changepassword', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed'); setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Could not change password'); } finally { setPwBusy(false); }
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text('EventSphere — Organizer Report', 14, 20);
      doc.setFontSize(11); doc.setTextColor(120);
      doc.text(`${user?.name || ''}${user?.company ? ` · ${user.company}` : ''}`, 14, 28);
      doc.text(`Generated ${dayjs().format('MMM D, YYYY')}`, 14, 34);
      autoTable(doc, {
        startY: 42,
        head: [['Expo', 'Status', 'Booths', 'Sessions', 'Applications', 'Occupancy']],
        body: expos.map(e => {
          const c = expoCounts(e._id);
          return [e.title, e.status, c.booths, c.sessions, c.applications, c.booths ? `${Math.round((c.occupied / c.booths) * 100)}%` : '0%'];
        }),
        headStyles: { fillColor: [108, 61, 232] },
        styles: { fontSize: 9 },
      });
      doc.save(`organizer-report-${dayjs().format('YYYY-MM-DD')}.pdf`);
    } catch { toast.error('Could not generate PDF'); }
  };

  // ── Render: badges ────────────────────────────────────────────────────────
  const AppBadge = ({ status }) => { const s = APP_STATUS[status] || APP_STATUS.pending; return <span className="od-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{s.label}</span>; };
  const ExpoBadge = ({ status }) => { const s = EXPO_STATUS[status] || EXPO_STATUS.draft; return <span className="od-badge" style={{ background: `${s.color}1e`, color: s.color, borderColor: `${s.color}55` }}>{s.label}</span>; };
  const Stars = ({ n }) => <span className="od-stars">{'★'.repeat(n || 0)}{'☆'.repeat(5 - (n || 0))}</span>;

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const upcomingSessions = useMemo(() => {
    const weekEnd = dayjs().add(7, 'day');
    return Object.entries(sessionsByExpo).flatMap(([eid, list]) => (list || []).map(s => ({ ...s, _expoTitle: expos.find(e => e._id === eid)?.title })))
      .filter(s => dayjs(s.startTime).isAfter(dayjs()) && dayjs(s.startTime).isBefore(weekEnd))
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).slice(0, 5);
  }, [sessionsByExpo, expos]);

  const renderOverview = () => {
    const statCards = [
      { label: 'Total Expos', value: expos.length, color: '#7b2ff7', icon: '🎪' },
      { label: 'Applications', value: allApplications.length, color: '#00d4ff', icon: '📋' },
      { label: 'Pending', value: pendingApps.length, color: '#ffb300', icon: '⏳', alert: pendingApps.length > 0 },
      { label: 'Sessions', value: totalSessions, color: '#e83d8a', icon: '📅' },
      { label: 'Booths', value: totalBooths, color: '#00ff88', icon: '🏪' },
      { label: 'Messages', value: inbox.length, color: '#ff6b35', icon: '💬' },
    ];
    return (
      <>
        <div className="od-welcome">
          <div>
            <h2 className="od-welcome-title">Welcome back, {user?.name?.split(' ')[0] || 'Organizer'} 👋</h2>
            <p className="od-welcome-sub"><span className="od-role-chip">Organizer</span> · managing {expos.length} expo{expos.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="od-btn-primary" onClick={() => navigate('/expos/create')}>➕ Create New Expo</button>
        </div>

        <div className="od-stats six">
          {statCards.map(s => (
            <div key={s.label} className={`od-stat-card ${s.alert ? 'alert' : ''}`}>
              <div className="od-stat-icon" style={{ background: `${s.color}1e`, border: `1px solid ${s.color}38`, color: s.color }}>{s.icon}</div>
              <div>
                <div className="od-stat-value" style={{ color: s.color }}><CountUp value={s.value} /></div>
                <div className="od-stat-label">{s.label}</div>
              </div>
              {s.alert && <span className="od-attention">!</span>}
            </div>
          ))}
        </div>

        {pendingApps.length > 0 && (
          <div className="od-card od-pending-card">
            <div><span className="od-pending-icon">📋</span><div><strong>{pendingApps.length} application{pendingApps.length !== 1 ? 's' : ''} need your review</strong><p className="od-muted">Approve or reject pending exhibitor applications.</p></div></div>
            <button className="od-btn-primary" onClick={() => go('applications')}>Review Now →</button>
          </div>
        )}

        <div className="od-grid-2">
          <div className="od-card">
            <div className="od-bh-top"><span className="od-card-title">🎪 My Expos</span><button className="od-link-btn" onClick={() => go('expos')}>View All</button></div>
            {expos.length === 0 ? <p className="od-muted">No expos yet.</p> : (
              <div className="od-mini-expos">
                {expos.slice(0, 3).map(e => (
                  <div key={e._id} className="od-mini-expo">
                    <div className="od-mini-expo-info" onClick={() => navigate(`/expos/${e._id}`)}>
                      <strong>{e.title}</strong>
                      <span className="od-muted">{fmtDate(e.startDate)}</span>
                    </div>
                    <div className="od-mini-actions">
                      <ExpoBadge status={e.status} />
                      <button title="Edit" onClick={() => navigate(`/expos/${e._id}/edit`)}>✏️</button>
                      <button title="Booths" onClick={() => { setBoothExpo(e._id); go('booths'); }}>🏪</button>
                      <button title="Sessions" onClick={() => { setSessExpo(e._id); go('sessions'); }}>📅</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="od-card">
            <div className="od-bh-top"><span className="od-card-title">🛡️ Recent Activity</span></div>
            {activity.length === 0 ? <p className="od-muted">No recent activity.</p> : (
              <ul className="od-activity">
                {activity.slice(0, 5).map(a => (
                  <li key={a._id}><span className="od-act-dot" /><div><span>{a.action}{a.details ? ` · ${a.details}` : ''}</span><span className="od-muted od-act-time">{ago(a.createdAt)}</span></div></li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="od-card" style={{ marginTop: 18 }}>
          <h3 className="od-card-title">📅 Upcoming Sessions This Week</h3>
          {upcomingSessions.length === 0 ? <p className="od-muted">No sessions scheduled in the next 7 days.</p> : (
            <div className="od-up-sessions">
              {upcomingSessions.map(s => (
                <div key={s._id} className="od-up-session">
                  <div className="od-up-when"><strong>{dayjs(s.startTime).format('ddd D')}</strong><span>{dayjs(s.startTime).format('h:mm A')}</span></div>
                  <div><strong>{s.title}</strong><p className="od-muted">{s._expoTitle}{s.location ? ` · ${s.location}` : ''}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="od-quick-actions">
          <button className="od-qa" onClick={() => navigate('/expos/create')}>➕ Create New Expo</button>
          <button className="od-qa" onClick={() => go('applications')}>📋 Review Applications</button>
          <button className="od-qa" onClick={() => { if (sessExpo) go('sessions'); else go('sessions'); }}>📅 Add Session</button>
          <button className="od-qa" onClick={() => go('messages')}>💬 View Messages</button>
        </div>
      </>
    );
  };

  // ── MY EXPOS ──────────────────────────────────────────────────────────────
  const filteredExpos = useMemo(() => expos.filter(e => {
    if (expoFilter !== 'all' && e.status !== expoFilter) return false;
    if (expoSearch && !(e.title || '').toLowerCase().includes(expoSearch.toLowerCase())) return false;
    return true;
  }), [expos, expoFilter, expoSearch]);

  const renderExpos = () => (
    <>
      <div className="od-section-head">
        <h2 className="od-h2">My Expos</h2>
        <button className="od-btn-primary" onClick={() => navigate('/expos/create')}>➕ Create New Expo</button>
      </div>
      {expos.length === 0 ? (
        <div className="od-empty"><span className="od-empty-icon">🎪</span><h3>No Expos Yet</h3><p>Create your first expo to start managing booths, sessions and exhibitors.</p><button className="od-btn-primary" onClick={() => navigate('/expos/create')}>Create First Expo →</button></div>
      ) : (
        <>
          <div className="od-filter-row">
            <select className="od-input od-sel" value={expoFilter} onChange={e => setExpoFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.keys(EXPO_STATUS).map(s => <option key={s} value={s}>{EXPO_STATUS[s].label}</option>)}
            </select>
            <input className="od-input" placeholder="🔍 Search by title…" value={expoSearch} onChange={e => setExpoSearch(e.target.value)} />
          </div>
          <div className="od-expo-grid">
            {filteredExpos.map(e => {
              const c = expoCounts(e._id);
              const occ = c.booths ? Math.round((c.occupied / c.booths) * 100) : 0;
              return (
                <div key={e._id} className="od-card od-expo-card">
                  <div className="od-expo-top" onClick={() => navigate(`/expos/${e._id}`)}>
                    <h4 className="od-expo-title">{e.title}</h4>
                    <ExpoBadge status={e.status} />
                  </div>
                  {e.category && <span className="od-chip">{e.category}</span>}
                  <p className="od-app-meta">📅 {fmtDate(e.startDate)} – {fmtDate(e.endDate)}</p>
                  <p className="od-app-meta">📍 {e.location?.venue || '—'}{e.location?.city ? `, ${e.location.city}` : ''}</p>
                  <div className="od-expo-counts">
                    <span>🏪 {c.booths} booths</span><span>📅 {c.sessions} sessions</span><span>📋 {c.applications} apps</span>
                  </div>
                  <div className="od-occ"><div className="od-occ-bar"><span style={{ width: `${occ}%` }} /></div><span className="od-occ-label">{occ}% occupied</span></div>
                  <div className="od-expo-actions">
                    <button title="Edit" onClick={() => navigate(`/expos/${e._id}/edit`)}>✏️</button>
                    <button title="Manage Booths" onClick={() => { setBoothExpo(e._id); go('booths'); }}>🏪</button>
                    <button title="Manage Sessions" onClick={() => { setSessExpo(e._id); go('sessions'); }}>📅</button>
                    <button title="View Applications" onClick={() => { setAppExpoFilter(e._id); go('applications'); }}>👥</button>
                    <button title="Delete" className="od-del" onClick={() => deleteExpo(e)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  // ── APPLICATIONS ──────────────────────────────────────────────────────────
  const filteredApps = useMemo(() => allApplications.filter(a => {
    if (appExpoFilter !== 'all' && a._expo?._id !== appExpoFilter) return false;
    if (appStatusFilter !== 'all' && a.status !== appStatusFilter) return false;
    if (appSearch && !(a.companyName || '').toLowerCase().includes(appSearch.toLowerCase())) return false;
    return true;
  }), [allApplications, appExpoFilter, appStatusFilter, appSearch]);

  const appStats = useMemo(() => ({
    total: allApplications.length,
    pending: allApplications.filter(a => a.status === 'pending').length,
    approved: allApplications.filter(a => a.status === 'approved').length,
    rejected: allApplications.filter(a => a.status === 'rejected').length,
  }), [allApplications]);

  const renderApplications = () => (
    <>
      <h2 className="od-h2">Exhibitor Applications</h2>
      <div className="od-ministats">
        {[['Total', appStats.total, '#7b2ff7'], ['Pending', appStats.pending, '#ffb300'], ['Approved', appStats.approved, '#00ff88'], ['Rejected', appStats.rejected, '#ff006e']].map(([l, v, c]) => (
          <div key={l} className="od-ministat"><span className="od-ministat-v" style={{ color: c }}>{v}</span><span className="od-ministat-l">{l}</span></div>
        ))}
      </div>
      <div className="od-filter-row">
        <select className="od-input od-sel" value={appExpoFilter} onChange={e => setAppExpoFilter(e.target.value)}>
          <option value="all">All expos</option>
          {expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
        </select>
        <select className="od-input od-sel" value={appStatusFilter} onChange={e => setAppStatusFilter(e.target.value)}>
          <option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <input className="od-input" placeholder="🔍 Search company…" value={appSearch} onChange={e => setAppSearch(e.target.value)} />
      </div>
      {filteredApps.length === 0 ? (
        <div className="od-empty"><span className="od-empty-icon">📋</span><h3>No applications</h3><p>Exhibitor applications for your expos will appear here.</p></div>
      ) : (
        <div className="od-app-grid">
          {filteredApps.map(a => (
            <div key={a._id} className="od-card od-app-card">
              <div className="od-app-top"><h4 className="od-app-company">{a.companyName}</h4><AppBadge status={a.status} /></div>
              {a.category && <span className="od-chip">{a.category}</span>}
              <p className="od-app-meta">🎪 {a._expo?.title || '—'}</p>
              <p className="od-app-meta" style={{ textTransform: 'capitalize' }}>🪧 Booth pref: {a.boothPreference || '—'}</p>
              <p className="od-app-meta">📅 Applied {ago(a.createdAt)}</p>
              {(a.products || []).length > 0 && <div className="od-tags">{a.products.slice(0, 4).map(p => <span key={p} className="od-tag">{p}</span>)}</div>}
              {a.assignedBooth && <div className="od-booth-badge">🏪 {a.assignedBooth.boothNumber || 'Assigned'}</div>}
              {a.status === 'rejected' && a.rejectionReason && <div className="od-reject">❌ {a.rejectionReason}</div>}
              {a.status === 'pending' && (
                <div className="od-quick-row" style={{ marginTop: 10 }}>
                  <button className="od-btn-primary od-sm" onClick={() => { setApproveModal(a); setApproveBooth(''); }}>✅ Approve</button>
                  <button className="od-btn-danger od-sm" onClick={() => { setRejectModal(a); setRejectReason(''); }}>❌ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── BOOTHS ────────────────────────────────────────────────────────────────
  const renderBooths = () => {
    const list = boothsByExpo[boothExpo] || [];
    const counts = { available: list.filter(b => b.status === 'available').length, reserved: list.filter(b => b.status === 'reserved').length, occupied: list.filter(b => b.status === 'occupied').length };
    return (
      <>
        <div className="od-section-head"><h2 className="od-h2">Booth Management</h2>{list.length > 0 && <button className="od-btn-ghost" onClick={exportBooths}>⬇ Export CSV</button>}</div>
        {expos.length === 0 ? (
          <div className="od-empty"><span className="od-empty-icon">🏪</span><h3>No expos yet</h3><p>Create an expo to manage its booths.</p></div>
        ) : (
          <>
            <div className="od-filter-row">
              <select className="od-input od-sel" value={boothExpo} onChange={e => setBoothExpo(e.target.value)}>
                {expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
              </select>
              <div className="od-view-toggle">
                <button className={boothView === 'grid' ? 'active' : ''} onClick={() => setBoothView('grid')}>▦ Grid</button>
                <button className={boothView === 'list' ? 'active' : ''} onClick={() => setBoothView('list')}>☰ List</button>
              </div>
            </div>
            <div className="od-booth-legend">
              {Object.entries(counts).map(([k, v]) => <span key={k}><i style={{ background: BOOTH_COLOR[k] }} /> {k} ({v})</span>)}
            </div>
            {list.length === 0 ? <div className="od-empty"><span className="od-empty-icon">🏪</span><p>No booths for this expo.</p></div> : boothView === 'grid' ? (
              <div className="od-booth-grid">
                {list.map(b => (
                  <button key={b._id} className="od-booth-cell" style={{ borderColor: `${BOOTH_COLOR[b.status]}66`, background: `${BOOTH_COLOR[b.status]}1a` }} onClick={() => { setBoothModal(b); setBoothStatusEdit(b.status); }}>
                    <span className="od-booth-no" style={{ color: BOOTH_COLOR[b.status] }}>{b.boothNumber}</span>
                    <span className="od-booth-size">{b.size}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>Booth</th><th>Size</th><th>Status</th><th>Price</th><th>Exhibitor</th><th></th></tr></thead>
                  <tbody>
                    {list.map(b => (
                      <tr key={b._id}>
                        <td><strong>{b.boothNumber}</strong></td><td style={{ textTransform: 'capitalize' }}>{b.size}</td>
                        <td><span style={{ color: BOOTH_COLOR[b.status], textTransform: 'capitalize' }}>● {b.status}</span></td>
                        <td>${b.price || 0}</td><td>{b.exhibitor?.name || b.exhibitor?.company || '—'}</td>
                        <td><button className="od-link-btn" onClick={() => { setBoothModal(b); setBoothStatusEdit(b.status); }}>Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  // ── SESSIONS ──────────────────────────────────────────────────────────────
  const renderSessions = () => {
    const list = (sessionsByExpo[sessExpo] || []).slice().sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    return (
      <>
        <div className="od-section-head"><h2 className="od-h2">Sessions</h2>{expos.length > 0 && <button className="od-btn-primary" onClick={() => openSessForm('add')}>➕ Add Session</button>}</div>
        {expos.length === 0 ? (
          <div className="od-empty"><span className="od-empty-icon">📅</span><h3>No expos yet</h3><p>Create an expo to schedule sessions.</p></div>
        ) : (
          <>
            <div className="od-filter-row">
              <select className="od-input od-sel" value={sessExpo} onChange={e => setSessExpo(e.target.value)}>
                {expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
              </select>
            </div>
            {list.length === 0 ? (
              <div className="od-empty"><span className="od-empty-icon">📅</span><h3>No sessions yet</h3><p>Add a session to build this expo's agenda.</p><button className="od-btn-primary" onClick={() => openSessForm('add')}>Add Session →</button></div>
            ) : (
              <div className="od-session-grid">
                {list.map(s => {
                  const count = s.registeredAttendees?.length || 0;
                  const pct = s.maxAttendees ? Math.min(100, Math.round((count / s.maxAttendees) * 100)) : 0;
                  return (
                    <div key={s._id} className="od-card od-session-card">
                      <div className="od-session-top">{s.category && <span className="od-chip">{s.category}</span>}<span className="od-muted" style={{ fontSize: '0.74rem', textTransform: 'capitalize' }}>{s.status}</span></div>
                      <h4 className="od-session-title">{s.title}</h4>
                      {s.speaker?.name && <p className="od-app-meta">🎤 {s.speaker.name}{s.speaker.company ? ` · ${s.speaker.company}` : ''}</p>}
                      <p className="od-app-meta">🕐 {dayjs(s.startTime).format('MMM D, h:mm A')}</p>
                      {s.location && <p className="od-app-meta">📍 {s.location}</p>}
                      <p className="od-app-meta">👥 {count}{s.maxAttendees ? ` / ${s.maxAttendees}` : ''} registered</p>
                      {s.maxAttendees ? <div className="od-progress"><span style={{ width: `${pct}%` }} /></div> : null}
                      <div className="od-quick-row" style={{ marginTop: 10 }}>
                        <button className="od-btn-ghost od-sm" onClick={() => openSessForm('edit', s)}>✏️ Edit</button>
                        <button className="od-btn-danger od-sm" onClick={() => deleteSession(s)}>🗑️ Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    );
  };

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  const renderAnalytics = () => {
    const chartText = { color: '#f0f0ff' };
    const grid = { color: 'rgba(255,255,255,0.05)' };
    // Booth status: combined uses analytics.boothStats; per-expo uses expoAnalytics.boothOccupancy
    let boothDist = { available: 0, reserved: 0, occupied: 0 };
    if (anExpo === 'all') (analytics?.boothStats || []).forEach(b => { boothDist[b._id] = b.count; });
    else if (expoAnalytics) boothDist = expoAnalytics.boothOccupancy;
    const doughnutData = { labels: ['Available', 'Reserved', 'Occupied'], datasets: [{ data: [boothDist.available || 0, boothDist.reserved || 0, boothDist.occupied || 0], backgroundColor: ['#00ff88', '#ffb300', '#7b2ff7'], borderColor: '#0a0a1a', borderWidth: 3 }] };

    const appsPerExpo = expos.map(e => ({ title: e.title, n: (appsByExpo[e._id] || []).length }));
    const barData = { labels: appsPerExpo.map(x => x.title.length > 14 ? x.title.slice(0, 13) + '…' : x.title), datasets: [{ label: 'Applications', data: appsPerExpo.map(x => x.n), backgroundColor: '#6c3de8', borderRadius: 6 }] };

    const ot = analytics?.attendanceOverTime || [];
    const lineData = { labels: ot.map(d => dayjs(d._id).format('MMM D')), datasets: [{ label: 'Registrations', data: ot.map(d => d.count), borderColor: '#e83d8a', backgroundColor: 'rgba(232,61,138,0.18)', fill: true, tension: 0.35, pointRadius: 3 }] };

    const catCount = {};
    Object.values(sessionsByExpo).flat().forEach(s => { if (s.category) catCount[s.category] = (catCount[s.category] || 0) + 1; });
    const catData = { labels: Object.keys(catCount), datasets: [{ label: 'Sessions', data: Object.values(catCount), backgroundColor: ['#00d4ff', '#7b2ff7', '#e83d8a', '#ff6b35', '#00ff88'], borderRadius: 6 }] };

    const allSessions = Object.values(sessionsByExpo).flat();
    const popular = allSessions.slice().sort((a, b) => (b.registeredAttendees?.length || 0) - (a.registeredAttendees?.length || 0))[0];
    const occRate = totalBooths ? Math.round((Object.values(boothsByExpo).flat().filter(b => b.status === 'occupied').length / totalBooths) * 100) : 0;
    const metrics = [
      { label: 'Attendees Registered', value: analytics?.totalAttendance || 0, color: '#00d4ff', icon: '👥' },
      { label: 'Booth Occupancy', value: `${occRate}%`, color: '#00ff88', icon: '🏪' },
      { label: 'Total Revenue', value: `$${analytics?.totalRevenue || 0}`, color: '#ff6b35', icon: '💰' },
      { label: 'Sessions', value: totalSessions, color: '#7b2ff7', icon: '📅' },
    ];

    return (
      <>
        <div className="od-section-head">
          <h2 className="od-h2">Analytics</h2>
          <div className="od-quick-row">
            <select className="od-input od-sel" value={anExpo} onChange={e => setAnExpo(e.target.value)}>
              <option value="all">All expos (combined)</option>
              {expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
            </select>
            <button className="od-btn-ghost" onClick={exportPDF}>⬇ Export PDF</button>
          </div>
        </div>

        <div className="od-stats">
          {metrics.map(c => (
            <div key={c.label} className="od-stat-card">
              <div className="od-stat-icon" style={{ background: `${c.color}1e`, border: `1px solid ${c.color}38`, color: c.color }}>{c.icon}</div>
              <div><div className="od-stat-value" style={{ color: c.color, fontSize: typeof c.value === 'string' ? '1.5rem' : undefined }}>{typeof c.value === 'number' ? <CountUp value={c.value} /> : c.value}</div><div className="od-stat-label">{c.label}</div></div>
            </div>
          ))}
        </div>
        {popular && <p className="od-muted" style={{ marginBottom: 16 }}>🔥 Most popular session: <strong style={{ color: '#f0f0ff' }}>{popular.title}</strong> ({popular.registeredAttendees?.length || 0} registered)</p>}

        <div className="od-grid-2">
          <div className="od-card"><h3 className="od-card-title">Booth Status Distribution</h3><div className="od-chart"><Doughnut data={doughnutData} options={{ plugins: { legend: { labels: chartText, position: 'bottom' } }, cutout: '62%' }} /></div></div>
          <div className="od-card"><h3 className="od-card-title">Applications per Expo</h3><div className="od-chart"><Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: chartText, grid }, y: { ticks: { ...chartText, precision: 0 }, grid, beginAtZero: true } } }} /></div></div>
        </div>
        <div className="od-grid-2" style={{ marginTop: 18 }}>
          <div className="od-card"><h3 className="od-card-title">Registrations Over Time</h3><div className="od-chart">{ot.length ? <Line data={lineData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: chartText, grid }, y: { ticks: { ...chartText, precision: 0 }, grid, beginAtZero: true } } }} /> : <p className="od-muted">No check-in data yet.</p>}</div></div>
          <div className="od-card"><h3 className="od-card-title">Sessions by Category</h3><div className="od-chart">{Object.keys(catCount).length ? <Bar data={catData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: chartText, grid }, y: { ticks: { ...chartText, precision: 0 }, grid, beginAtZero: true } } }} /> : <p className="od-muted">No categorized sessions yet.</p>}</div></div>
        </div>
      </>
    );
  };

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  const renderMessages = () => {
    const list = (msgView === 'inbox' ? inbox : sent).filter(m => {
      if (!msgSearch) return true;
      const who = msgView === 'inbox' ? m.sender : m.recipient;
      return (who?.name || '').toLowerCase().includes(msgSearch.toLowerCase()) || (m.subject || '').toLowerCase().includes(msgSearch.toLowerCase());
    });
    return (
      <>
        <div className="od-section-head"><h2 className="od-h2">Messages</h2><button className="od-btn-primary" onClick={() => { setComposeForm({ recipient: '', subject: '', content: '' }); setComposeOpen(true); }}>✉️ Compose</button></div>
        <div className="od-msg-split">
          <div className="od-msg-left">
            <div className="od-msg-tabs">
              <button className={`od-msg-tab ${msgView === 'inbox' ? 'active' : ''}`} onClick={() => { setMsgView('inbox'); setSelectedMsg(null); }}>Inbox {unreadCount > 0 && <span className="od-pill">{unreadCount}</span>}</button>
              <button className={`od-msg-tab ${msgView === 'sent' ? 'active' : ''}`} onClick={() => { setMsgView('sent'); setSelectedMsg(null); }}>Sent</button>
            </div>
            <div className="od-msg-toolbar"><input className="od-input od-sm" placeholder="🔍 Search…" value={msgSearch} onChange={e => setMsgSearch(e.target.value)} />{msgView === 'inbox' && unreadCount > 0 && <button className="od-link-btn" onClick={markAllRead}>Mark all read</button>}</div>
            {list.length === 0 ? <div className="od-empty sm"><span className="od-empty-icon">💬</span><p>Your {msgView} is empty.</p></div> : (
              <div className="od-msg-list">
                {list.map(m => { const who = msgView === 'inbox' ? m.sender : m.recipient; const unread = !m.isRead && msgView === 'inbox'; return (
                  <div key={m._id} className={`od-msg ${unread ? 'unread' : ''} ${selectedMsg?._id === m._id ? 'sel' : ''}`} onClick={() => openMessage(m)}>
                    <div className="od-msg-avatar">{who?.name?.[0]?.toUpperCase() || '?'}</div>
                    <div className="od-msg-body"><div className="od-msg-row"><strong>{who?.name || 'Unknown'}</strong><span className="od-msg-time">{ago(m.createdAt)}</span></div>{m.subject && <div className={`od-msg-subject ${unread ? 'b' : ''}`}>{m.subject}</div>}<div className="od-msg-preview">{(m.content || '').slice(0, 60)}</div></div>
                    {unread && <span className="od-dot" />}
                  </div>
                ); })}
              </div>
            )}
          </div>
          <div className="od-msg-right">
            {!selectedMsg ? <div className="od-empty"><span className="od-empty-icon">📬</span><h3>Select a message to read</h3><p>Choose a conversation from the list.</p></div> : (
              <div className="od-msg-detail">
                <div className="od-msg-detail-head"><div className="od-msg-avatar lg">{(msgView === 'inbox' ? selectedMsg.sender : selectedMsg.recipient)?.name?.[0]?.toUpperCase() || '?'}</div><div><strong>{(msgView === 'inbox' ? selectedMsg.sender : selectedMsg.recipient)?.name || 'Unknown'}</strong><p className="od-muted">{dayjs(selectedMsg.createdAt).format('MMM D, YYYY h:mm A')}</p></div></div>
                <h3 className="od-msg-detail-subject">{selectedMsg.subject || '(No subject)'}</h3>
                <p className="od-msg-detail-body">{selectedMsg.content}</p>
                {msgView === 'inbox' && (
                  <div className="od-reply"><textarea className="od-input od-textarea" rows={3} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" /><div className="od-quick-row" style={{ marginTop: 10 }}><button className="od-btn-primary od-sm" onClick={sendReply} disabled={replyBusy || !replyText.trim()}>{replyBusy ? 'Sending…' : 'Reply'}</button><button className="od-btn-danger od-sm" onClick={() => deleteMessage(selectedMsg._id)}>Delete</button></div></div>
                )}
                {msgView === 'sent' && <button className="od-btn-danger od-sm" style={{ marginTop: 14 }} onClick={() => deleteMessage(selectedMsg._id)}>Delete</button>}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── FEEDBACK ──────────────────────────────────────────────────────────────
  const filteredFb = useMemo(() => feedback.filter(f => {
    if (fbType !== 'all' && f.type !== fbType) return false;
    if (fbStatus !== 'all' && f.status !== fbStatus) return false;
    if (fbExpo !== 'all' && f.expo?._id !== fbExpo) return false;
    if (fbRating !== 'all' && String(f.rating || '') !== fbRating) return false;
    return true;
  }), [feedback, fbType, fbStatus, fbExpo, fbRating]);
  const avgRating = useMemo(() => { const r = feedback.filter(f => f.rating); return r.length ? (r.reduce((s, f) => s + f.rating, 0) / r.length).toFixed(1) : '—'; }, [feedback]);

  const renderFeedback = () => (
    <>
      <h2 className="od-h2">Feedback</h2>
      <div className="od-ministats">
        <div className="od-ministat"><span className="od-ministat-v" style={{ color: '#7b2ff7' }}>{feedback.length}</span><span className="od-ministat-l">Total</span></div>
        <div className="od-ministat"><span className="od-ministat-v" style={{ color: '#ffb300' }}>{feedback.filter(f => f.status === 'open').length}</span><span className="od-ministat-l">Open</span></div>
        <div className="od-ministat"><span className="od-ministat-v" style={{ color: '#00ff88' }}>{feedback.filter(f => f.status === 'resolved').length}</span><span className="od-ministat-l">Resolved</span></div>
        <div className="od-ministat"><span className="od-ministat-v" style={{ color: '#00d4ff' }}>{avgRating}</span><span className="od-ministat-l">Avg Rating</span></div>
      </div>
      <div className="od-filter-row">
        <select className="od-input od-sel" value={fbType} onChange={e => setFbType(e.target.value)}><option value="all">All types</option>{Object.keys(FB_TYPE_ICON).map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select className="od-input od-sel" value={fbStatus} onChange={e => setFbStatus(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select>
        <select className="od-input od-sel" value={fbExpo} onChange={e => setFbExpo(e.target.value)}><option value="all">All expos</option>{expos.map(e => <option key={e._id} value={e._id}>{e.title}</option>)}</select>
        <select className="od-input od-sel" value={fbRating} onChange={e => setFbRating(e.target.value)}><option value="all">Any rating</option>{[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} stars</option>)}</select>
      </div>
      {filteredFb.length === 0 ? (
        <div className="od-empty"><span className="od-empty-icon">⭐</span><h3>No feedback</h3><p>Feedback submitted for your expos will appear here.</p></div>
      ) : (
        <div className="od-app-grid">
          {filteredFb.map(f => (
            <div key={f._id} className="od-card od-fb-card">
              <div className="od-app-top"><span className="od-fb-type">{FB_TYPE_ICON[f.type] || '💬'} {f.type}</span><span className="od-badge" style={{ color: FB_STATUS[f.status], borderColor: `${FB_STATUS[f.status]}55`, background: `${FB_STATUS[f.status]}1e` }}>{f.status}</span></div>
              <h4 className="od-app-company">{f.subject}</h4>
              {f.rating && <Stars n={f.rating} />}
              <p className="od-fb-msg">{f.message}</p>
              <p className="od-app-meta">👤 {f.user?.name || 'Anonymous'}{f.expo?.title ? ` · ${f.expo.title}` : ''}</p>
              <p className="od-app-date">{fmtDate(f.createdAt)}</p>
              <button className="od-btn-ghost od-sm" style={{ marginTop: 8 }} onClick={() => cycleFeedback(f)}>Mark {f.status === 'open' ? 'In Progress' : f.status === 'in-progress' ? 'Resolved' : 'Open'}</button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const renderSettings = () => (
    <>
      <h2 className="od-h2">Settings</h2>
      <div className="od-card">
        <h3 className="od-card-title">Organizer Profile</h3>
        <div className="od-form-row">
          <div><label className="od-label">Name</label><input className="od-input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
          <div><label className="od-label">Email (read only)</label><input className="od-input" value={user?.email || ''} readOnly disabled /></div>
        </div>
        <div className="od-form-row">
          <div><label className="od-label">Phone</label><input className="od-input" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
          <div><label className="od-label">Company / Organization</label><input className="od-input" value={profileForm.company} onChange={e => setProfileForm({ ...profileForm, company: e.target.value })} /></div>
        </div>
        <label className="od-label">Bio</label>
        <textarea className="od-input od-textarea" rows={3} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} />
        <button className="od-btn-primary" style={{ marginTop: 16 }} onClick={saveProfile} disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save Profile'}</button>
      </div>

      <div className="od-card" style={{ marginTop: 18 }}>
        <h3 className="od-card-title">Notification Preferences</h3>
        {[['applicationUpdates', 'New application alerts'], ['newMessages', 'Message notifications'], ['expoAnnouncements', 'Expo update reminders']].map(([k, label]) => (
          <label key={k} className="od-toggle-row"><span>{label}</span><button type="button" className={`od-toggle ${prefs[k] ? 'on' : ''}`} onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })}><span /></button></label>
        ))}
        <button className="od-btn-primary" style={{ marginTop: 16 }} onClick={savePrefs} disabled={prefsBusy}>{prefsBusy ? 'Saving…' : 'Save Preferences'}</button>
      </div>

      <div className="od-card" style={{ marginTop: 18 }}>
        <h3 className="od-card-title">Change Password</h3>
        <label className="od-label">Current Password</label>
        <input className="od-input" type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
        <div className="od-form-row">
          <div><label className="od-label">New Password</label><input className="od-input" type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
          <div><label className="od-label">Confirm New Password</label><input className="od-input" type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
        </div>
        <button className="od-btn-primary" style={{ marginTop: 16 }} onClick={changePassword} disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Change Password'}</button>
      </div>
    </>
  );

  const renderSkeleton = () => (
    <>
      <Skel w="40%" h={34} style={{ marginBottom: 22 }} />
      <div className="od-stats six">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="od-stat-card"><Skel w={48} h={48} r={14} /><div style={{ flex: 1 }}><Skel w="50%" h={22} /><Skel w="70%" h={12} style={{ marginTop: 8 }} /></div></div>)}</div>
      <div className="od-grid-2" style={{ marginTop: 18 }}>{[0, 1].map(i => <div key={i} className="od-card"><Skel w="40%" h={18} /><Skel h={90} style={{ marginTop: 14 }} /></div>)}</div>
    </>
  );

  const TABS = { overview: renderOverview, expos: renderExpos, applications: renderApplications, booths: renderBooths, sessions: renderSessions, analytics: renderAnalytics, messages: renderMessages, feedback: renderFeedback, settings: renderSettings };
  const initial = (user?.name || '?')[0]?.toUpperCase();
  const pendingBanner = !bannerDismissed && pendingApps.length > 0;
  const availableBooths = (boothsByExpo[approveModal?._expo?._id] || []).filter(b => b.status === 'available');

  return (
    <div className="od-shell">
      <div className="od-orb od-orb-1" />
      <div className="od-orb od-orb-2" />

      <div className="od-mobilebar"><button className="od-burger" onClick={() => setSidebarOpen(o => !o)}>☰</button><span className="od-mobilebar-title">Organizer</span></div>

      <aside className={`od-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="od-side-top">
          <div className="od-side-avatar">{initial}</div>
          <div className="od-side-name">{user?.name}</div>
          <span className="od-side-role">Organizer</span>
          <span className="od-side-sub">{expos.length} expo{expos.length !== 1 ? 's' : ''} managed</span>
        </div>
        <nav className="od-nav">
          {NAV.map(item => (
            <button key={item.key} className={`od-nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => go(item.key)}>
              <span className="od-nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.key === 'expos' && expos.length > 0 && <span className="od-nav-badge">{expos.length}</span>}
              {item.key === 'applications' && pendingApps.length > 0 && <span className="od-nav-badge pink pulse">{pendingApps.length}</span>}
              {item.key === 'messages' && unreadCount > 0 && <span className="od-nav-badge pink">{unreadCount}</span>}
            </button>
          ))}
        </nav>
        <div className="od-side-bottom">
          <button className="od-side-link" onClick={() => setNotifPanel(true)}>🔔 Notifications {notifications.length > 0 && <span className="od-pill">{notifications.length}</span>}</button>
          <button className="od-side-link" onClick={() => navigate('/home')}>↩ Back to Home</button>
          <button className="od-side-link od-logout" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>

      {sidebarOpen && <div className="od-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="od-main">
        {pendingBanner && <div className="od-banner"><span>📋 You have <strong>{pendingApps.length}</strong> pending exhibitor application{pendingApps.length !== 1 ? 's' : ''}</span><div><button className="od-btn-primary od-sm" onClick={() => { setBannerDismissed(false); go('applications'); }}>Review Now</button><button className="od-banner-x" onClick={() => setBannerDismissed(true)}>✕</button></div></div>}
        {loading ? renderSkeleton() : <div className="od-tabwrap" key={tab}>{TABS[tab]()}</div>}
      </main>

      {/* Notifications panel */}
      {notifPanel && (
        <div className="od-overlay" onClick={() => setNotifPanel(false)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>Notifications</h3><button className="od-modal-x" onClick={() => setNotifPanel(false)}>✕</button></div>
            <div className="od-modal-body">
              {notifications.length > 0 && <button className="od-link-btn" style={{ marginBottom: 10 }} onClick={markAllRead}>Mark all as read</button>}
              {notifications.length === 0 ? <p className="od-muted">No notifications.</p> : (
                <ul className="od-notif-list">{notifications.map(n => <li key={n._id} className={`od-notif ${n.isRead ? '' : 'unread'}`}><span className="od-notif-title">{n.title}</span><span className="od-notif-msg">{n.message}</span><span className="od-notif-time">{ago(n.createdAt)}</span></li>)}</ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve modal */}
      {approveModal && (
        <div className="od-overlay" onClick={() => !actionBusy && setApproveModal(null)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>Approve {approveModal.companyName}</h3><button className="od-modal-x" onClick={() => setApproveModal(null)}>✕</button></div>
            <div className="od-modal-body">
              <p className="od-muted" style={{ marginBottom: 10 }}>Assign an available booth (optional).</p>
              <label className="od-label">Booth</label>
              <select className="od-input od-sel" value={approveBooth} onChange={e => setApproveBooth(e.target.value)} style={{ maxWidth: '100%' }}>
                <option value="">No booth (approve only)</option>
                {availableBooths.map(b => <option key={b._id} value={b._id}>{b.boothNumber} · {b.size}</option>)}
              </select>
              {availableBooths.length === 0 && <p className="od-muted" style={{ fontSize: '0.8rem' }}>No available booths in this expo.</p>}
            </div>
            <div className="od-modal-foot"><button className="od-btn-ghost" onClick={() => setApproveModal(null)} disabled={actionBusy}>Cancel</button><button className="od-btn-primary" onClick={doApprove} disabled={actionBusy}>{actionBusy ? 'Approving…' : 'Approve'}</button></div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="od-overlay" onClick={() => !actionBusy && setRejectModal(null)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>Reject {rejectModal.companyName}</h3><button className="od-modal-x" onClick={() => setRejectModal(null)}>✕</button></div>
            <div className="od-modal-body"><label className="od-label">Reason</label><textarea className="od-input od-textarea" rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Let the exhibitor know why…" /></div>
            <div className="od-modal-foot"><button className="od-btn-ghost" onClick={() => setRejectModal(null)} disabled={actionBusy}>Cancel</button><button className="od-btn-danger" onClick={doReject} disabled={actionBusy}>{actionBusy ? 'Rejecting…' : 'Reject Application'}</button></div>
          </div>
        </div>
      )}

      {/* Booth modal */}
      {boothModal && (
        <div className="od-overlay" onClick={() => setBoothModal(null)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>Booth {boothModal.boothNumber}</h3><button className="od-modal-x" onClick={() => setBoothModal(null)}>✕</button></div>
            <div className="od-modal-body">
              <div className="od-detail-row"><span>Size</span><strong style={{ textTransform: 'capitalize' }}>{boothModal.size}</strong></div>
              <div className="od-detail-row"><span>Price</span><strong>${boothModal.price || 0}</strong></div>
              <div className="od-detail-row"><span>Exhibitor</span><strong>{boothModal.exhibitor?.name || boothModal.exhibitor?.company || '—'}</strong></div>
              <label className="od-label">Status</label>
              <select className="od-input od-sel" value={boothStatusEdit} onChange={e => setBoothStatusEdit(e.target.value)} style={{ maxWidth: '100%' }}>
                {['available', 'reserved', 'occupied'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="od-modal-foot"><button className="od-btn-danger" onClick={releaseBooth}>Release Booth</button><button className="od-btn-primary" onClick={saveBoothStatus}>Save Status</button></div>
          </div>
        </div>
      )}

      {/* Session form modal */}
      {sessModal && sessForm && (
        <div className="od-overlay" onClick={() => !sessBusy && setSessModal(null)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>{sessModal.mode === 'edit' ? 'Edit Session' : 'Add Session'}</h3><button className="od-modal-x" onClick={() => setSessModal(null)}>✕</button></div>
            <div className="od-modal-body">
              <label className="od-label">Title *</label>
              <input className="od-input" value={sessForm.title} onChange={e => setSessForm({ ...sessForm, title: e.target.value })} />
              <label className="od-label">Description</label>
              <textarea className="od-input od-textarea" rows={2} value={sessForm.description} onChange={e => setSessForm({ ...sessForm, description: e.target.value })} />
              <div className="od-form-row">
                <div><label className="od-label">Start *</label><input className="od-input" type="datetime-local" value={sessForm.startTime} onChange={e => setSessForm({ ...sessForm, startTime: e.target.value })} /></div>
                <div><label className="od-label">End *</label><input className="od-input" type="datetime-local" value={sessForm.endTime} onChange={e => setSessForm({ ...sessForm, endTime: e.target.value })} /></div>
              </div>
              <div className="od-form-row">
                <div><label className="od-label">Location / Room</label><input className="od-input" value={sessForm.location} onChange={e => setSessForm({ ...sessForm, location: e.target.value })} /></div>
                <div><label className="od-label">Category</label><select className="od-input od-sel" value={sessForm.category} onChange={e => setSessForm({ ...sessForm, category: e.target.value })} style={{ maxWidth: '100%' }}><option value="">Select…</option>{SESSION_CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <label className="od-label">Max Attendees</label>
              <input className="od-input" type="number" min={0} value={sessForm.maxAttendees} onChange={e => setSessForm({ ...sessForm, maxAttendees: e.target.value })} />
              <div className="od-form-row">
                <div><label className="od-label">Speaker Name</label><input className="od-input" value={sessForm.speakerName} onChange={e => setSessForm({ ...sessForm, speakerName: e.target.value })} /></div>
                <div><label className="od-label">Speaker Company</label><input className="od-input" value={sessForm.speakerCompany} onChange={e => setSessForm({ ...sessForm, speakerCompany: e.target.value })} /></div>
              </div>
              <label className="od-label">Speaker Bio</label>
              <textarea className="od-input od-textarea" rows={2} value={sessForm.speakerBio} onChange={e => setSessForm({ ...sessForm, speakerBio: e.target.value })} />
            </div>
            <div className="od-modal-foot"><button className="od-btn-ghost" onClick={() => setSessModal(null)} disabled={sessBusy}>Cancel</button><button className="od-btn-primary" onClick={saveSession} disabled={sessBusy}>{sessBusy ? 'Saving…' : sessModal.mode === 'edit' ? 'Save Changes' : 'Create Session'}</button></div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div className="od-overlay" onClick={() => !composeBusy && setComposeOpen(false)}>
          <div className="od-modal" onClick={e => e.stopPropagation()}>
            <div className="od-modal-head"><h3>New Message</h3><button className="od-modal-x" onClick={() => setComposeOpen(false)}>✕</button></div>
            <div className="od-modal-body">
              <label className="od-label">To</label>
              <select className="od-input od-sel" value={composeForm.recipient} onChange={e => setComposeForm({ ...composeForm, recipient: e.target.value })} style={{ maxWidth: '100%' }}>
                <option value="">Choose a recipient…</option>
                {recipients.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
              </select>
              {recipients.length === 0 && <p className="od-muted" style={{ fontSize: '0.8rem' }}>Recipients appear once exhibitors apply to your expos.</p>}
              <label className="od-label">Subject</label>
              <input className="od-input" value={composeForm.subject} onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })} />
              <label className="od-label">Message</label>
              <textarea className="od-input od-textarea" rows={4} value={composeForm.content} onChange={e => setComposeForm({ ...composeForm, content: e.target.value })} />
            </div>
            <div className="od-modal-foot"><button className="od-btn-ghost" onClick={() => setComposeOpen(false)} disabled={composeBusy}>Cancel</button><button className="od-btn-primary" onClick={submitCompose} disabled={composeBusy}>{composeBusy ? 'Sending…' : 'Send Message'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
