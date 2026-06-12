import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { QRCodeCanvas } from 'qrcode.react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
// Styles live in src/global.css (imported by pages/_app.jsx) — Next.js forbids
// importing global CSS from a non-_app file, so we @import it there instead.

dayjs.extend(relativeTime);
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// ── Constants ───────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',     icon: '📊', label: 'Overview' },
  { key: 'applications', icon: '📋', label: 'My Applications' },
  { key: 'booth',        icon: '🏪', label: 'My Booth' },
  { key: 'profile',      icon: '👔', label: 'Company Profile' },
  { key: 'schedule',     icon: '📅', label: 'Expo Schedule' },
  { key: 'messages',     icon: '💬', label: 'Messages' },
  { key: 'analytics',    icon: '📈', label: 'Analytics' },
  { key: 'settings',     icon: '⚙️', label: 'Settings' },
];

const STATUS_STYLE = {
  approved: { bg: 'rgba(0,255,136,0.12)', color: '#00ff88', border: 'rgba(0,255,136,0.3)', label: 'Approved' },
  rejected: { bg: 'rgba(255,0,110,0.12)', color: '#ff80ab', border: 'rgba(255,0,110,0.3)', label: 'Rejected' },
  pending:  { bg: 'rgba(255,179,0,0.12)', color: '#ffb300', border: 'rgba(255,179,0,0.3)', label: 'Pending' },
};
const SESSION_STATUS_STYLE = {
  scheduled: { color: '#00d4ff', label: 'Scheduled' },
  ongoing:   { color: '#00ff88', label: 'Live' },
  completed: { color: 'rgba(240,240,255,0.5)', label: 'Completed' },
  cancelled: { color: '#ff80ab', label: 'Cancelled' },
};
const AMENITIES = ['WiFi', 'Power outlets', 'Display screen', 'Storage space', 'Furniture'];
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '200+'];
const MSG_TYPES = ['general', 'inquiry', 'collaboration', 'support'];
const BOOTH_SIZES = [
  { value: 'small', label: 'Small · 3×3m' },
  { value: 'medium', label: 'Medium · 3×6m' },
  { value: 'large', label: 'Large · 6×6m' },
  { value: 'extra-large', label: 'Extra-Large · 6×9m' },
];
const DEFAULT_PREFS = {
  applicationUpdates: true, newMessages: true, expoAnnouncements: true,
  sessionReminders: true, boothAlerts: true,
};

// ── Small helpers ─────────────────────────────────────────────────────────--
function CountUp({ value }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    const dur = 900;
    cancelAnimationFrame(ref.current);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  return <>{n}</>;
}

const Skel = ({ w = '100%', h = 16, r = 8, style }) =>
  <span className="exh-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;

const ago = (d) => { const v = dayjs(d); return v.isValid() ? v.fromNow() : ''; };
const fmtDate = (d) => { const v = dayjs(d); return v.isValid() ? v.format('MMM D, YYYY') : '—'; };

// Tag input: type and press Enter to add, click × to remove.
function TagInput({ tags, setTags, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setDraft('');
  };
  return (
    <div className="exh-taginput">
      <div className="exh-tags">
        {tags.map(t => (
          <span key={t} className="exh-tag">{t}<button type="button" onClick={() => setTags(tags.filter(x => x !== t))}>×</button></span>
        ))}
      </div>
      <input
        className="exh-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder || 'Type and press Enter…'}
      />
    </div>
  );
}

export default function ExhibitorDashboard() {
  const { user, logout, updateProfile } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [notifPanel, setNotifPanel] = useState(false);

  // Data
  const [applications, setApplications] = useState([]);
  const [expos, setExpos] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Apply modal
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ expo: '', companyName: '', companyDescription: '', website: '', category: '', boothPreference: 'medium', notes: '' });
  const [applyTags, setApplyTags] = useState([]);
  const [applyErr, setApplyErr] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);

  // Applications tab filters
  const [appFilter, setAppFilter] = useState('all');
  const [appSearch, setAppSearch] = useState('');

  // Booth tab
  const [boothForm, setBoothForm] = useState({ description: '', staffCount: 0, notes: '' });
  const [boothProducts, setBoothProducts] = useState([]);
  const [boothAmenities, setBoothAmenities] = useState([]);
  const [boothBusy, setBoothBusy] = useState(false);
  const qrRef = useRef(null);

  // Profile tab
  const [profileForm, setProfileForm] = useState({ company: '', bio: '', category: '', website: '', avatar: '', phone: '', foundedYear: '', companySize: '', linkedin: '', twitter: '' });
  const [profileBusy, setProfileBusy] = useState(false);

  // Schedule tab
  const [scheduleExpo, setScheduleExpo] = useState('');
  const [sessCat, setSessCat] = useState('all');
  const [sessStatus, setSessStatus] = useState('all');
  const [sessDate, setSessDate] = useState('');

  // Messages tab
  const [msgView, setMsgView] = useState('inbox');
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({ recipient: '', type: 'general', subject: '', content: '' });
  const [recipients, setRecipients] = useState([]);
  const [composeBusy, setComposeBusy] = useState(false);

  // Settings tab
  const [accountForm, setAccountForm] = useState({ name: '', phone: '', bio: '' });
  const [accountBusy, setAccountBusy] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [deactOpen, setDeactOpen] = useState(false);
  const [deactPw, setDeactPw] = useState('');
  const [deactBusy, setDeactBusy] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────--
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [appsRes, exposRes, notifRes, inboxRes, sentRes] = await Promise.all([
        api.get('/api/exhibitors/my'),
        api.get('/api/expos?limit=100'),
        api.get('/api/notifications').catch(() => ({ data: { data: [] } })),
        api.get('/api/messages/inbox').catch(() => ({ data: { data: [] } })),
        api.get('/api/messages/sent').catch(() => ({ data: { data: [] } })),
      ]);
      const apps = appsRes.data.data || [];
      setApplications(apps);
      setExpos(exposRes.data.data || []);
      setNotifications(notifRes.data.data || []);
      setInbox(inboxRes.data.data || []);
      setSent(sentRes.data.data || []);

      // Sessions from the expos the exhibitor is APPROVED for.
      const approvedExpos = [...new Map(
        apps.filter(a => a.status === 'approved' && a.expo?._id).map(a => [a.expo._id, a.expo])
      ).values()];
      const sessRes = await Promise.all(approvedExpos.map(e =>
        api.get(`/api/sessions/expo/${e._id}`)
          .then(r => (r.data.data || []).map(s => ({ ...s, _expoId: e._id, _expoTitle: e.title })))
          .catch(() => [])
      ));
      setSessions(sessRes.flat());
      setScheduleExpo(prev => prev || approvedExpos[0]?._id || '');
    } catch {
      if (!silent) toast.error('Could not load your dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time: when a notification arrives (e.g. booth_approved), silently refresh.
  useEffect(() => {
    if (!socket) return;
    const onNotif = (n) => {
      setNotifications(prev => [n, ...prev]);
      fetchAll(true);
    };
    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [socket, fetchAll]);

  // Seed forms from the current user.
  useEffect(() => {
    if (!user) return;
    setProfileForm({
      company: user.company || '', bio: user.bio || '', category: user.category || '',
      website: user.website || '', avatar: user.avatar || '', phone: user.phone || '',
      foundedYear: user.foundedYear || '', companySize: user.companySize || '',
      linkedin: user.social?.linkedin || '', twitter: user.social?.twitter || '',
    });
    setAccountForm({ name: user.name || '', phone: user.phone || '', bio: user.bio || '' });
    setPrefs({ ...DEFAULT_PREFS, ...(user.notificationPrefs || {}) });
  }, [user]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: applications.length,
    approved: applications.filter(a => a.status === 'approved').length,
    pending: applications.filter(a => a.status === 'pending').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }), [applications]);

  const approvedApps = useMemo(() => applications.filter(a => a.status === 'approved'), [applications]);
  const pendingApps = useMemo(() => applications.filter(a => a.status === 'pending'), [applications]);
  const boothApps = useMemo(() => approvedApps.filter(a => a.assignedBooth), [approvedApps]);
  const activeBoothApp = useMemo(() => boothApps[0] || null, [boothApps]);
  const activeBooth = activeBoothApp?.assignedBooth || null;
  const unreadCount = useMemo(() => inbox.filter(m => !m.isRead).length, [inbox]);
  const isActive = approvedApps.length > 0;

  // Load booth form when active booth changes.
  useEffect(() => {
    if (activeBooth) {
      setBoothForm({ description: activeBooth.description || '', staffCount: activeBooth.staffCount || 0, notes: activeBooth.notes || '' });
      setBoothProducts(activeBooth.products || []);
      setBoothAmenities(activeBooth.amenities || []);
    }
  }, [activeBooth]);

  const approvedExpoTabs = useMemo(() =>
    [...new Map(approvedApps.filter(a => a.expo?._id).map(a => [a.expo._id, a.expo])).values()],
  [approvedApps]);

  // ── Actions ─────────────────────────────────────────────────────────────--
  const go = (t) => { setTab(t); setSidebarOpen(false); setNotifPanel(false); };
  const handleLogout = () => { logout(); navigate('/login'); };

  const openApply = () => {
    setApplyErr('');
    setApplyForm({ expo: '', companyName: user?.company || '', companyDescription: user?.bio || '', website: user?.website || '', category: user?.category || '', boothPreference: 'medium', notes: '' });
    setApplyTags([]);
    setApplyOpen(true);
  };

  const submitApply = async () => {
    setApplyErr('');
    if (!applyForm.expo) return setApplyErr('Please choose an expo');
    if (!applyForm.companyName.trim()) return setApplyErr('Company name is required');
    setApplyBusy(true);
    try {
      await api.post('/api/exhibitors', { ...applyForm, products: applyTags });
      toast.success('Application submitted!');
      setApplyOpen(false);
      fetchAll(true);
    } catch (err) {
      setApplyErr(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setApplyBusy(false);
    }
  };

  const withdrawApp = async (a) => {
    if (!window.confirm(`Withdraw your application for "${a.expo?.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/exhibitors/${a._id}`);
      toast.success('Application withdrawn');
      setApplications(prev => prev.filter(x => x._id !== a._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not withdraw application');
    }
  };

  const saveBooth = async () => {
    if (!activeBooth) return;
    setBoothBusy(true);
    try {
      await api.put(`/api/booths/${activeBooth._id}`, {
        description: boothForm.description,
        products: boothProducts,
        amenities: boothAmenities,
        staffCount: Number(boothForm.staffCount) || 0,
        notes: boothForm.notes,
      });
      toast.success('Booth updated');
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update booth');
    } finally {
      setBoothBusy(false);
    }
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    try {
      await updateProfile({
        company: profileForm.company, bio: profileForm.bio, category: profileForm.category,
        website: profileForm.website, avatar: profileForm.avatar, phone: profileForm.phone,
        foundedYear: profileForm.foundedYear, companySize: profileForm.companySize,
        social: { linkedin: profileForm.linkedin, twitter: profileForm.twitter },
      });
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save profile');
    } finally {
      setProfileBusy(false);
    }
  };

  const saveAccount = async () => {
    setAccountBusy(true);
    try {
      await updateProfile({ name: accountForm.name, phone: accountForm.phone, bio: accountForm.bio });
      toast.success('Account updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update account');
    } finally {
      setAccountBusy(false);
    }
  };

  const changePassword = async () => {
    if (pwForm.newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match');
    setPwBusy(true);
    try {
      await api.put('/api/auth/changepassword', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally {
      setPwBusy(false);
    }
  };

  const savePrefs = async () => {
    setPrefsBusy(true);
    try {
      await updateProfile({ notificationPrefs: prefs });
      toast.success('Preferences saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save preferences');
    } finally {
      setPrefsBusy(false);
    }
  };

  const deactivate = async () => {
    if (!deactPw) return toast.error('Enter your password to confirm');
    setDeactBusy(true);
    try {
      await api.put('/api/auth/deactivate', { password: deactPw });
      toast.info('Your account has been deactivated');
      setTimeout(() => { logout(); navigate('/login'); }, 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not deactivate account');
      setDeactBusy(false);
    }
  };

  const toggleSession = async (s) => {
    const registered = (s.registeredAttendees || []).some(a => (a._id || a) === user._id);
    try {
      if (registered) { await api.delete(`/api/sessions/${s._id}/register`); toast.info('Unregistered from session'); }
      else { await api.post(`/api/sessions/${s._id}/register`); toast.success('Registered for session'); }
      fetchAll(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update registration');
    }
  };

  // Messages
  const openCompose = async (preset = {}) => {
    setComposeForm({ recipient: preset.recipient || '', type: 'general', subject: preset.subject || '', content: '' });
    setComposeOpen(true);
    try {
      const ids = [...new Set(applications.map(a => a.expo?._id).filter(Boolean))];
      const details = await Promise.all(ids.map(id => api.get(`/api/expos/${id}`).then(r => r.data.data).catch(() => null)));
      const orgs = {};
      details.forEach(e => { if (e?.organizer?._id) orgs[e.organizer._id] = e.organizer.name; });
      setRecipients(Object.entries(orgs).map(([_id, name]) => ({ _id, name })));
    } catch { setRecipients([]); }
  };

  const submitCompose = async () => {
    if (!composeForm.recipient) return toast.error('Choose a recipient');
    if (!composeForm.content.trim()) return toast.error('Write a message');
    setComposeBusy(true);
    try {
      await api.post('/api/messages', composeForm);
      toast.success('Message sent');
      setComposeOpen(false);
      const sentRes = await api.get('/api/messages/sent');
      setSent(sentRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send message');
    } finally {
      setComposeBusy(false);
    }
  };

  const openMessage = async (m) => {
    setSelectedMsg(m);
    setReplyText('');
    if (!m.isRead && msgView === 'inbox') {
      try {
        await api.put(`/api/messages/${m._id}/read`);
        setInbox(prev => prev.map(x => x._id === m._id ? { ...x, isRead: true } : x));
      } catch { /* ignore */ }
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedMsg) return;
    setReplyBusy(true);
    try {
      await api.post('/api/messages', {
        recipient: selectedMsg.sender?._id || selectedMsg.sender,
        subject: selectedMsg.subject ? `Re: ${selectedMsg.subject}` : 'Reply',
        content: replyText,
        type: selectedMsg.type || 'general',
      });
      toast.success('Reply sent');
      setReplyText('');
      const sentRes = await api.get('/api/messages/sent');
      setSent(sentRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send reply');
    } finally {
      setReplyBusy(false);
    }
  };

  const deleteMessage = async (id) => {
    try {
      await api.delete(`/api/messages/${id}`);
      setInbox(prev => prev.filter(m => m._id !== id));
      setSent(prev => prev.filter(m => m._id !== id));
      setSelectedMsg(null);
      toast.success('Message deleted');
    } catch { toast.error('Could not delete message'); }
  };

  const markAllRead = async () => {
    try { await api.put('/api/notifications/read-all').catch(() => {}); } catch { /* ignore */ }
    try {
      await Promise.all(inbox.filter(m => !m.isRead).map(m => api.put(`/api/messages/${m._id}/read`).catch(() => {})));
      setInbox(prev => prev.map(m => ({ ...m, isRead: true })));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  // QR download / print
  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `booth-${activeBooth?.boothNumber || 'qr'}.png`; a.click();
  };
  const printQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const w = window.open('', '_blank', 'width=420,height=520');
    w.document.write(`<title>Booth ${activeBooth?.boothNumber}</title><div style="text-align:center;font-family:sans-serif;padding:24px"><h2>Booth ${activeBooth?.boothNumber}</h2><p>${activeBoothApp?.expo?.title || ''}</p><img src="${canvas.toDataURL('image/png')}" style="width:300px"/></div>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 250);
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text('EventSphere — Participation History', 14, 20);
      doc.setFontSize(11); doc.setTextColor(120);
      doc.text(`${user?.company || user?.name || ''}`, 14, 28);
      doc.text(`Generated ${dayjs().format('MMM D, YYYY')}`, 14, 34);
      autoTable(doc, {
        startY: 42,
        head: [['Expo', 'Dates', 'Booth', 'Status']],
        body: applications.map(a => [
          a.expo?.title || '—',
          a.expo?.startDate ? fmtDate(a.expo.startDate) : '—',
          a.assignedBooth?.boothNumber || '—',
          a.status,
        ]),
        headStyles: { fillColor: [108, 61, 232] },
        styles: { fontSize: 9 },
      });
      doc.save(`participation-${(user?.company || 'exhibitor').replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch {
      toast.error('Could not generate PDF');
    }
  };

  const pwStrength = useMemo(() => {
    const p = pwForm.newPassword;
    if (!p) return { score: 0, label: '', color: '#555' };
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    const map = [
      { label: 'Too short', color: '#ff006e' },
      { label: 'Weak', color: '#ff6b35' },
      { label: 'Fair', color: '#ffb300' },
      { label: 'Good', color: '#00d4ff' },
      { label: 'Strong', color: '#00ff88' },
    ];
    return { score: s, ...map[s] };
  }, [pwForm.newPassword]);

  // ── Render: badges ────────────────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
    return <span className="exh-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{s.label}</span>;
  };

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <>
      <div className="exh-welcome">
        <div>
          <h2 className="exh-welcome-title">Welcome back, {user?.company || user?.name?.split(' ')[0] || 'Exhibitor'} 👋</h2>
          <p className="exh-welcome-sub"><span className="exh-role-chip">Exhibitor</span> · {isActive ? `${approvedApps.length} active participation${approvedApps.length > 1 ? 's' : ''}` : 'Getting started'}</p>
        </div>
        <span className="exh-status-pill" style={{ background: isActive ? 'rgba(0,255,136,0.12)' : 'rgba(255,179,0,0.12)', color: isActive ? '#00ff88' : '#ffb300', borderColor: isActive ? 'rgba(0,255,136,0.3)' : 'rgba(255,179,0,0.3)' }}>
          ● {isActive ? 'Active Exhibitor' : 'Pending'}
        </span>
      </div>

      <div className="exh-stats">
        {[
          { label: 'Total Applications', value: stats.total, color: '#7b2ff7', icon: '📋' },
          { label: 'Approved', value: stats.approved, color: '#00ff88', icon: '✅' },
          { label: 'Pending', value: stats.pending, color: '#ffb300', icon: '⏳' },
          { label: 'Assigned Booths', value: boothApps.length, color: '#00d4ff', icon: '🏪' },
        ].map(s => (
          <div key={s.label} className="exh-stat-card">
            <div className="exh-stat-icon" style={{ background: `${s.color}1e`, border: `1px solid ${s.color}38`, color: s.color }}>{s.icon}</div>
            <div>
              <div className="exh-stat-value" style={{ color: s.color }}><CountUp value={s.value} /></div>
              <div className="exh-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="exh-grid-2">
        {activeBooth ? (
          <div className="exh-card exh-booth-highlight">
            <div className="exh-bh-top">
              <span className="exh-card-title">🏪 Active Booth</span>
              <span className="exh-badge" style={{ background: 'rgba(0,255,136,0.12)', color: '#00ff88', borderColor: 'rgba(0,255,136,0.3)' }}>{activeBooth.status}</span>
            </div>
            <div className="exh-bh-num">{activeBooth.boothNumber}</div>
            <p className="exh-bh-expo">{activeBoothApp?.expo?.title}</p>
            <p className="exh-app-meta">📅 {fmtDate(activeBoothApp?.expo?.startDate)}{activeBoothApp?.expo?.endDate ? ` – ${fmtDate(activeBoothApp.expo.endDate)}` : ''}</p>
            <p className="exh-app-meta" style={{ textTransform: 'capitalize' }}>📐 {activeBooth.size}{activeBooth.location?.zone ? ` · Zone ${activeBooth.location.zone}` : ''}</p>
            <div className="exh-quick-row" style={{ marginTop: 14 }}>
              <button className="exh-btn-ghost" onClick={() => activeBoothApp?.expo?._id && navigate(`/expos/${activeBoothApp.expo._id}/floor`)}>View Floor Plan</button>
              <button className="exh-btn-primary" onClick={() => go('booth')}>Edit Booth Details</button>
            </div>
          </div>
        ) : (
          <div className="exh-card exh-empty-card">
            <span className="exh-empty-icon">🏪</span>
            <p>No active booth yet. Apply to an expo and get approved to claim a booth.</p>
            <button className="exh-btn-primary" onClick={openApply}>Apply for Expo</button>
          </div>
        )}

        <div className="exh-card">
          <div className="exh-bh-top">
            <span className="exh-card-title">🔔 Recent Activity</span>
            <button className="exh-link-btn" onClick={() => setNotifPanel(true)}>View All</button>
          </div>
          {notifications.length === 0 ? <p className="exh-muted">No notifications yet.</p> : (
            <ul className="exh-notif-list">
              {notifications.slice(0, 3).map(n => (
                <li key={n._id} className="exh-notif">
                  <span className="exh-notif-title">{n.title}</span>
                  <span className="exh-notif-msg">{n.message}</span>
                  <span className="exh-notif-time">{ago(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="exh-card" style={{ marginTop: 18 }}>
        <h3 className="exh-card-title">🎪 Upcoming Expo Participation</h3>
        {approvedApps.length === 0 ? <p className="exh-muted">No approved expos yet.</p> : (
          <div className="exh-part-list">
            {approvedApps.map(a => (
              <button key={a._id} className="exh-part-row" onClick={() => a.expo?._id && navigate(`/expos/${a.expo._id}`)}>
                <div>
                  <strong>{a.expo?.title}</strong>
                  <span className="exh-muted"> · {fmtDate(a.expo?.startDate)}</span>
                </div>
                <div className="exh-part-right">
                  {a.assignedBooth && <span className="exh-booth-badge">🏪 {a.assignedBooth.boothNumber}</span>}
                  <StatusBadge status={a.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="exh-quick-actions">
        <button className="exh-qa" onClick={openApply}>🎪 Apply for New Expo</button>
        <button className="exh-qa" onClick={() => go('booth')}>🏪 Manage My Booth</button>
        <button className="exh-qa" onClick={() => openCompose()}>💬 Send Message</button>
        <button className="exh-qa" onClick={() => go('profile')}>👔 Update Profile</button>
      </div>
    </>
  );

  // ── APPLICATIONS ──────────────────────────────────────────────────────────
  const filteredApps = useMemo(() => applications.filter(a => {
    if (appFilter !== 'all' && a.status !== appFilter) return false;
    if (appSearch && !(a.expo?.title || '').toLowerCase().includes(appSearch.toLowerCase())) return false;
    return true;
  }), [applications, appFilter, appSearch]);

  const renderApplications = () => (
    <>
      <div className="exh-section-head">
        <h2 className="exh-h2">My Applications</h2>
        <button className="exh-btn-primary" onClick={openApply}>➕ Apply for New Expo</button>
      </div>

      <div className="exh-ministats">
        {[['Total', stats.total, '#7b2ff7'], ['Pending', stats.pending, '#ffb300'], ['Approved', stats.approved, '#00ff88'], ['Rejected', stats.rejected, '#ff006e']].map(([l, v, c]) => (
          <div key={l} className="exh-ministat"><span className="exh-ministat-v" style={{ color: c }}>{v}</span><span className="exh-ministat-l">{l}</span></div>
        ))}
      </div>

      <div className="exh-filter-row">
        <select className="exh-input exh-sel" value={appFilter} onChange={e => setAppFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="exh-input" placeholder="🔍 Search by expo name…" value={appSearch} onChange={e => setAppSearch(e.target.value)} />
      </div>

      {filteredApps.length === 0 ? (
        <div className="exh-empty">
          <span className="exh-empty-icon">📋</span>
          <h3>{applications.length === 0 ? 'No Applications Yet' : 'No matches'}</h3>
          <p>{applications.length === 0 ? 'Apply for an expo to showcase your products to thousands of attendees.' : 'Try a different filter or search term.'}</p>
          {applications.length === 0 && <button className="exh-btn-primary" onClick={openApply}>Apply Now →</button>}
        </div>
      ) : (
        <div className="exh-app-grid">
          {filteredApps.map(a => (
            <div key={a._id} className="exh-card exh-app-card">
              <div className="exh-app-top">
                <h4 className="exh-app-company">{a.expo?.title}</h4>
                <StatusBadge status={a.status} />
              </div>
              {(a.category || a.expo?.category) && <span className="exh-chip">{a.category || a.expo?.category}</span>}
              <p className="exh-app-meta">📅 {fmtDate(a.expo?.startDate)}</p>
              <p className="exh-app-meta">📍 {a.expo?.location?.venue || a.expo?.location?.city || '—'}</p>
              <p className="exh-app-meta">🏢 {a.companyName}</p>
              <p className="exh-app-meta" style={{ textTransform: 'capitalize' }}>🪧 Booth: {a.boothPreference || '—'}</p>
              {(a.products || []).length > 0 && (
                <div className="exh-tags" style={{ marginTop: 6 }}>{a.products.slice(0, 4).map(p => <span key={p} className="exh-tag static">{p}</span>)}</div>
              )}
              {a.assignedBooth && <div className="exh-booth-badge" style={{ marginTop: 8 }}>🏪 Assigned: {a.assignedBooth.boothNumber}</div>}
              {a.status === 'rejected' && a.rejectionReason && <div className="exh-reject">❌ {a.rejectionReason}</div>}
              <p className="exh-app-date">Applied {ago(a.createdAt)}</p>
              <div className="exh-quick-row" style={{ marginTop: 10 }}>
                <button className="exh-btn-ghost exh-sm" onClick={() => a.expo?._id && navigate(`/expos/${a.expo._id}`)}>View Expo</button>
                {a.status === 'pending' && <button className="exh-btn-danger exh-sm" onClick={() => withdrawApp(a)}>Withdraw</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── BOOTH ─────────────────────────────────────────────────────────────────
  const renderBooth = () => {
    if (!activeBooth) return (
      <>
        <h2 className="exh-h2">My Booth</h2>
        <div className="exh-empty">
          <span className="exh-empty-icon">🏪</span>
          <h3>You don't have an approved booth yet</h3>
          <p>Once an organizer approves your application and assigns a booth, you can manage it here.</p>
          <button className="exh-btn-primary" onClick={openApply}>Apply for Expo</button>
        </div>
      </>
    );
    const qrPayload = JSON.stringify({ booth: activeBooth.boothNumber, expo: activeBoothApp?.expo?.title, zone: activeBooth.location?.zone });
    return (
      <>
        <h2 className="exh-h2">My Booth</h2>
        <div className="exh-card exh-booth-header">
          <div className="exh-booth-num">{activeBooth.boothNumber}</div>
          <div className="exh-booth-header-info">
            <h3 className="exh-card-title" style={{ margin: 0 }}>{activeBoothApp?.expo?.title}</h3>
            <p className="exh-app-meta" style={{ textTransform: 'capitalize' }}>📐 {activeBooth.size}{activeBooth.location?.zone ? ` · Zone ${activeBooth.location.zone}` : ''}</p>
            <p className="exh-app-meta">📅 {fmtDate(activeBoothApp?.expo?.startDate)}</p>
            <p className="exh-app-meta">Reserved {fmtDate(activeBooth.updatedAt || activeBooth.createdAt)}</p>
          </div>
          <span className="exh-badge" style={{ background: 'rgba(0,255,136,0.12)', color: '#00ff88', borderColor: 'rgba(0,255,136,0.3)', textTransform: 'capitalize' }}>{activeBooth.status}</span>
        </div>

        <div className="exh-grid-2" style={{ marginTop: 18 }}>
          <div className="exh-card">
            <h3 className="exh-card-title">Booth Details</h3>
            <label className="exh-label">Booth Description</label>
            <textarea className="exh-input exh-textarea" rows={3} value={boothForm.description} onChange={e => setBoothForm({ ...boothForm, description: e.target.value })} placeholder="Tell attendees what you're showcasing…" />
            <label className="exh-label">Products / Services</label>
            <TagInput tags={boothProducts} setTags={setBoothProducts} placeholder="Add a product and press Enter…" />
            <label className="exh-label">Staff Count</label>
            <input className="exh-input" type="number" min={0} value={boothForm.staffCount} onChange={e => setBoothForm({ ...boothForm, staffCount: e.target.value })} />
            <label className="exh-label">Amenities</label>
            <div className="exh-checks">
              {AMENITIES.map(am => (
                <label key={am} className={`exh-check ${boothAmenities.includes(am) ? 'on' : ''}`}>
                  <input type="checkbox" checked={boothAmenities.includes(am)} onChange={() => setBoothAmenities(prev => prev.includes(am) ? prev.filter(x => x !== am) : [...prev, am])} />
                  {am}
                </label>
              ))}
            </div>
            <label className="exh-label">Notes</label>
            <textarea className="exh-input exh-textarea" rows={2} value={boothForm.notes} onChange={e => setBoothForm({ ...boothForm, notes: e.target.value })} placeholder="Internal notes…" />
            <button className="exh-btn-primary" style={{ marginTop: 16 }} onClick={saveBooth} disabled={boothBusy}>{boothBusy ? 'Saving…' : 'Save Changes'}</button>
          </div>

          <div className="exh-card">
            <h3 className="exh-card-title">Location</h3>
            <div className="exh-detail-row"><span>Zone</span><strong>{activeBooth.location?.zone || 'TBA'}</strong></div>
            <div className="exh-detail-row"><span>Row</span><strong>{activeBooth.location?.row || '—'}</strong></div>
            <div className="exh-detail-row"><span>Column</span><strong>{activeBooth.location?.column || '—'}</strong></div>
            <button className="exh-btn-ghost" style={{ marginTop: 14, width: '100%' }} onClick={() => activeBoothApp?.expo?._id && navigate(`/expos/${activeBoothApp.expo._id}/booths`)}>View on Floor Plan</button>

            <h3 className="exh-card-title" style={{ marginTop: 22 }}>Booth QR Code</h3>
            <p className="exh-muted" style={{ marginBottom: 12 }}>Share your booth location with attendees.</p>
            <div className="exh-qr" ref={qrRef}>
              <QRCodeCanvas value={qrPayload} size={150} bgColor="#0a0a1a" fgColor="#ffffff" level="M" marginSize={2} />
            </div>
            <div className="exh-quick-row" style={{ marginTop: 14, justifyContent: 'center' }}>
              <button className="exh-btn-ghost exh-sm" onClick={downloadQR}>⬇ Download</button>
              <button className="exh-btn-ghost exh-sm" onClick={printQR}>🖨 Print</button>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ── PROFILE ───────────────────────────────────────────────────────────────
  const renderProfile = () => (
    <>
      <h2 className="exh-h2">Company Profile</h2>
      <div className="exh-grid-2">
        <div className="exh-card">
          <h3 className="exh-card-title">Edit Company Information</h3>
          {[
            ['company', 'Company Name', 'text'],
            ['category', 'Industry / Category', 'text'],
            ['website', 'Website URL', 'text'],
            ['avatar', 'Company Logo URL', 'text'],
            ['phone', 'Contact Phone', 'tel'],
            ['foundedYear', 'Founded Year', 'text'],
          ].map(([k, label, type]) => (
            <React.Fragment key={k}>
              <label className="exh-label">{label}</label>
              <input className="exh-input" type={type} value={profileForm[k]} onChange={e => setProfileForm({ ...profileForm, [k]: e.target.value })} />
            </React.Fragment>
          ))}
          <label className="exh-label">Company Size</label>
          <select className="exh-input exh-sel" value={profileForm.companySize} onChange={e => setProfileForm({ ...profileForm, companySize: e.target.value })}>
            <option value="">Select…</option>
            {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
          </select>
          <label className="exh-label">Company Description</label>
          <textarea className="exh-input exh-textarea" rows={4} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Brief description of your company…" />
          <div className="exh-form-row">
            <div><label className="exh-label">LinkedIn URL</label><input className="exh-input" value={profileForm.linkedin} onChange={e => setProfileForm({ ...profileForm, linkedin: e.target.value })} placeholder="https://linkedin.com/company/…" /></div>
            <div><label className="exh-label">Twitter URL</label><input className="exh-input" value={profileForm.twitter} onChange={e => setProfileForm({ ...profileForm, twitter: e.target.value })} placeholder="https://twitter.com/…" /></div>
          </div>
          <button className="exh-btn-primary" style={{ marginTop: 16 }} onClick={saveProfile} disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save Profile'}</button>
        </div>

        <div className="exh-card">
          <h3 className="exh-card-title">Live Preview</h3>
          <div className="exh-preview">
            <div className="exh-preview-logo">
              {profileForm.avatar ? <img src={profileForm.avatar} alt="logo" /> : (profileForm.company || '?')[0]?.toUpperCase()}
            </div>
            <h4 className="exh-preview-name">{profileForm.company || 'Your Company'}</h4>
            {profileForm.category && <span className="exh-preview-cat">{profileForm.category}</span>}
            <p className="exh-preview-bio">{profileForm.bio || 'Your company description will appear here for attendees to read.'}</p>
            {profileForm.foundedYear && <p className="exh-preview-meta">📅 Founded {profileForm.foundedYear}</p>}
            {profileForm.companySize && <p className="exh-preview-meta">👥 {profileForm.companySize} employees</p>}
            {profileForm.website && <a className="exh-preview-link" href={profileForm.website} target="_blank" rel="noreferrer">🌐 {profileForm.website}</a>}
            {profileForm.phone && <p className="exh-preview-meta">📱 {profileForm.phone}</p>}
            <p className="exh-preview-note">This is how attendees see your profile</p>
          </div>
        </div>
      </div>
    </>
  );

  // ── SCHEDULE ──────────────────────────────────────────────────────────────
  const scheduleSessions = useMemo(() => {
    let list = sessions.filter(s => s._expoId === scheduleExpo);
    if (sessCat !== 'all') list = list.filter(s => s.category === sessCat);
    if (sessStatus !== 'all') list = list.filter(s => s.status === sessStatus);
    if (sessDate) list = list.filter(s => dayjs(s.startTime).format('YYYY-MM-DD') === sessDate);
    return list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }, [sessions, scheduleExpo, sessCat, sessStatus, sessDate]);

  const sessionCategories = useMemo(() => [...new Set(sessions.filter(s => s._expoId === scheduleExpo).map(s => s.category).filter(Boolean))], [sessions, scheduleExpo]);

  const renderSchedule = () => (
    <>
      <h2 className="exh-h2">Expo Schedule</h2>
      {approvedExpoTabs.length === 0 ? (
        <div className="exh-empty"><span className="exh-empty-icon">📅</span><h3>No Sessions</h3><p>Sessions from the expos you're exhibiting at will appear here once you're approved.</p></div>
      ) : (
        <>
          <div className="exh-expo-tabs">
            {approvedExpoTabs.map(e => (
              <button key={e._id} className={`exh-expo-tab ${scheduleExpo === e._id ? 'active' : ''}`} onClick={() => setScheduleExpo(e._id)}>{e.title}</button>
            ))}
          </div>
          <div className="exh-filter-row">
            <select className="exh-input exh-sel" value={sessCat} onChange={e => setSessCat(e.target.value)}>
              <option value="all">All categories</option>
              {sessionCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="exh-input exh-sel" value={sessStatus} onChange={e => setSessStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {['scheduled', 'ongoing', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="exh-input exh-sel" type="date" value={sessDate} onChange={e => setSessDate(e.target.value)} />
            {sessDate && <button className="exh-btn-ghost exh-sm" onClick={() => setSessDate('')}>Clear date</button>}
          </div>

          {scheduleSessions.length === 0 ? (
            <div className="exh-empty"><span className="exh-empty-icon">📭</span><h3>No sessions match</h3><p>Adjust the filters to see more sessions.</p></div>
          ) : (
            <div className="exh-session-grid">
              {scheduleSessions.map(s => {
                const registered = (s.registeredAttendees || []).some(a => (a._id || a) === user._id);
                const count = s.registeredAttendees?.length || 0;
                const pct = s.maxAttendees ? Math.min(100, Math.round((count / s.maxAttendees) * 100)) : 0;
                const full = s.maxAttendees && count >= s.maxAttendees && !registered;
                const st = SESSION_STATUS_STYLE[s.status] || SESSION_STATUS_STYLE.scheduled;
                return (
                  <div key={s._id} className="exh-card exh-session-card">
                    <div className="exh-session-top">
                      {s.category && <span className="exh-chip">{s.category}</span>}
                      <span className="exh-session-status" style={{ color: st.color }}>● {st.label}</span>
                    </div>
                    <h4 className="exh-session-title">{s.title}</h4>
                    {s.speaker?.name && (
                      <div className="exh-speaker">
                        <span className="exh-speaker-av">{s.speaker.name[0]?.toUpperCase()}</span>
                        <span>{s.speaker.name}{s.speaker.company ? ` · ${s.speaker.company}` : ''}</span>
                      </div>
                    )}
                    <p className="exh-app-meta">🕐 {dayjs(s.startTime).format('MMM D, h:mm A')}</p>
                    {s.location && <p className="exh-app-meta">📍 {s.location}</p>}
                    <p className="exh-app-meta">👥 {count}{s.maxAttendees ? ` / ${s.maxAttendees}` : ''} registered</p>
                    {s.maxAttendees ? <div className="exh-progress"><span style={{ width: `${pct}%` }} /></div> : null}
                    {registered ? (
                      <div style={{ marginTop: 10 }}>
                        <span className="exh-booth-badge">✓ Registered</span>
                        <button className="exh-link-btn" style={{ marginLeft: 10 }} onClick={() => toggleSession(s)}>Unregister</button>
                      </div>
                    ) : (
                      <button className="exh-btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={() => toggleSession(s)} disabled={full}>{full ? 'Full' : 'Register'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  const renderMessages = () => {
    const list = (msgView === 'inbox' ? inbox : sent).filter(m => {
      if (!msgSearch) return true;
      const who = msgView === 'inbox' ? m.sender : m.recipient;
      return (who?.name || '').toLowerCase().includes(msgSearch.toLowerCase()) || (m.subject || '').toLowerCase().includes(msgSearch.toLowerCase());
    });
    return (
      <>
        <div className="exh-section-head">
          <h2 className="exh-h2">Messages</h2>
          <button className="exh-btn-primary" onClick={() => openCompose()}>✉️ Compose</button>
        </div>
        <div className="exh-msg-split">
          <div className="exh-msg-left">
            <div className="exh-msg-tabs">
              <button className={`exh-msg-tab ${msgView === 'inbox' ? 'active' : ''}`} onClick={() => { setMsgView('inbox'); setSelectedMsg(null); }}>Inbox {unreadCount > 0 && <span className="exh-pill">{unreadCount}</span>}</button>
              <button className={`exh-msg-tab ${msgView === 'sent' ? 'active' : ''}`} onClick={() => { setMsgView('sent'); setSelectedMsg(null); }}>Sent</button>
            </div>
            <div className="exh-msg-toolbar">
              <input className="exh-input exh-sm" placeholder="🔍 Search…" value={msgSearch} onChange={e => setMsgSearch(e.target.value)} />
              {msgView === 'inbox' && unreadCount > 0 && <button className="exh-link-btn" onClick={markAllRead}>Mark all read</button>}
            </div>
            {list.length === 0 ? (
              <div className="exh-empty sm"><span className="exh-empty-icon">💬</span><p>Your {msgView} is empty.</p></div>
            ) : (
              <div className="exh-msg-list">
                {list.map(m => {
                  const who = msgView === 'inbox' ? m.sender : m.recipient;
                  const unread = !m.isRead && msgView === 'inbox';
                  return (
                    <div key={m._id} className={`exh-msg ${unread ? 'unread' : ''} ${selectedMsg?._id === m._id ? 'sel' : ''}`} onClick={() => openMessage(m)}>
                      <div className="exh-msg-avatar">{who?.name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="exh-msg-body">
                        <div className="exh-msg-row"><strong>{who?.name || 'Unknown'}{who?.role && <span className="exh-role-mini">{who.role}</span>}</strong><span className="exh-msg-time">{ago(m.createdAt)}</span></div>
                        {m.subject && <div className={`exh-msg-subject ${unread ? 'b' : ''}`}>{m.subject}</div>}
                        <div className="exh-msg-preview">{(m.content || '').slice(0, 60)}</div>
                      </div>
                      {unread && <span className="exh-dot" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="exh-msg-right">
            {!selectedMsg ? (
              <div className="exh-empty"><span className="exh-empty-icon">📬</span><h3>Select a message to read</h3><p>Choose a conversation from the list on the left.</p></div>
            ) : (
              <div className="exh-msg-detail">
                <div className="exh-msg-detail-head">
                  <div className="exh-msg-avatar lg">{(msgView === 'inbox' ? selectedMsg.sender : selectedMsg.recipient)?.name?.[0]?.toUpperCase() || '?'}</div>
                  <div>
                    <strong>{(msgView === 'inbox' ? selectedMsg.sender : selectedMsg.recipient)?.name || 'Unknown'}</strong>
                    <p className="exh-muted">{dayjs(selectedMsg.createdAt).format('MMM D, YYYY h:mm A')}{selectedMsg.type ? ` · ${selectedMsg.type}` : ''}</p>
                  </div>
                </div>
                <h3 className="exh-msg-detail-subject">{selectedMsg.subject || '(No subject)'}</h3>
                <p className="exh-msg-detail-body">{selectedMsg.content}</p>
                {msgView === 'inbox' && (
                  <div className="exh-reply">
                    <textarea className="exh-input exh-textarea" rows={3} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" />
                    <div className="exh-quick-row" style={{ marginTop: 10 }}>
                      <button className="exh-btn-primary exh-sm" onClick={sendReply} disabled={replyBusy || !replyText.trim()}>{replyBusy ? 'Sending…' : 'Reply'}</button>
                      <button className="exh-btn-danger exh-sm" onClick={() => deleteMessage(selectedMsg._id)}>Delete</button>
                    </div>
                  </div>
                )}
                {msgView === 'sent' && <button className="exh-btn-danger exh-sm" style={{ marginTop: 14 }} onClick={() => deleteMessage(selectedMsg._id)}>Delete</button>}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  const renderAnalytics = () => {
    if (!activeBooth) return (
      <>
        <h2 className="exh-h2">Analytics</h2>
        <div className="exh-empty"><span className="exh-empty-icon">📈</span><h3>Analytics locked</h3><p>Get a booth approved to unlock your expo performance analytics.</p></div>
      </>
    );
    const sessionsRegistered = sessions.filter(s => (s.registeredAttendees || []).some(a => (a._id || a) === user._id)).length;
    const chartText = { color: '#f0f0ff' };
    const doughnutData = {
      labels: ['Pending', 'Approved', 'Rejected'],
      datasets: [{ data: [stats.pending, stats.approved, stats.rejected], backgroundColor: ['#ffb300', '#00ff88', '#ff006e'], borderColor: '#0a0a1a', borderWidth: 3 }],
    };
    // Applications per month, last 6 months
    const months = Array.from({ length: 6 }).map((_, i) => dayjs().subtract(5 - i, 'month'));
    const barData = {
      labels: months.map(m => m.format('MMM')),
      datasets: [{ label: 'Applications', data: months.map(m => applications.filter(a => dayjs(a.createdAt).isSame(m, 'month')).length), backgroundColor: '#7b2ff7', borderRadius: 6 }],
    };
    const sizeOrder = ['small', 'medium', 'large', 'extra-large'];
    const sizeData = {
      labels: sizeOrder,
      datasets: [{ label: 'Preference', data: sizeOrder.map(sz => applications.filter(a => a.boothPreference === sz).length), backgroundColor: ['#00d4ff', '#6c3de8', '#e83d8a', '#ff6b35'], borderRadius: 6 }],
    };
    const metrics = [
      { label: 'Expos Participated', value: approvedApps.length, color: '#7b2ff7', icon: '🎪' },
      { label: 'Booths Assigned', value: boothApps.length, color: '#00d4ff', icon: '🏪' },
      { label: 'Sessions Registered', value: sessionsRegistered, color: '#00ff88', icon: '📅' },
      { label: 'Messages Exchanged', value: inbox.length + sent.length, color: '#ff6b35', icon: '💬' },
    ];
    return (
      <>
        <div className="exh-section-head">
          <h2 className="exh-h2">Your Expo Performance</h2>
          <button className="exh-btn-ghost" onClick={exportPDF}>⬇ Export PDF</button>
        </div>
        <div className="exh-stats">
          {metrics.map(c => (
            <div key={c.label} className="exh-stat-card">
              <div className="exh-stat-icon" style={{ background: `${c.color}1e`, border: `1px solid ${c.color}38`, color: c.color }}>{c.icon}</div>
              <div><div className="exh-stat-value" style={{ color: c.color }}><CountUp value={c.value} /></div><div className="exh-stat-label">{c.label}</div></div>
            </div>
          ))}
        </div>

        <div className="exh-grid-2" style={{ marginTop: 18 }}>
          <div className="exh-card">
            <h3 className="exh-card-title">Application Status</h3>
            <div className="exh-chart"><Doughnut data={doughnutData} options={{ plugins: { legend: { labels: chartText, position: 'bottom' } }, cutout: '62%' }} /></div>
          </div>
          <div className="exh-card">
            <h3 className="exh-card-title">Applications · Last 6 Months</h3>
            <div className="exh-chart"><Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { x: { ticks: chartText, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { ...chartText, precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }} /></div>
          </div>
        </div>

        <div className="exh-grid-2" style={{ marginTop: 18 }}>
          <div className="exh-card">
            <h3 className="exh-card-title">Booth Size Preference History</h3>
            <div className="exh-chart"><Bar data={sizeData} options={{ indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { ...chartText, precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }, y: { ticks: chartText, grid: { display: false } } } }} /></div>
          </div>
          <div className="exh-card">
            <h3 className="exh-card-title">Participation Timeline</h3>
            {applications.length === 0 ? <p className="exh-muted">No participation yet.</p> : (
              <ul className="exh-history">
                {[...applications].sort((a, b) => new Date(b.expo?.startDate || b.createdAt) - new Date(a.expo?.startDate || a.createdAt)).map(a => (
                  <li key={a._id}>
                    <span>🎪 {a.expo?.title}<br /><span className="exh-muted" style={{ fontSize: '0.78rem' }}>{fmtDate(a.expo?.startDate)}{a.assignedBooth ? ` · ${a.assignedBooth.boothNumber}` : ''}</span></span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const renderSettings = () => (
    <>
      <h2 className="exh-h2">Settings</h2>
      <div className="exh-card">
        <h3 className="exh-card-title">Personal Account</h3>
        <div className="exh-form-row">
          <div><label className="exh-label">Full Name</label><input className="exh-input" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
          <div><label className="exh-label">Email (read only)</label><input className="exh-input" value={user?.email || ''} readOnly disabled /></div>
        </div>
        <label className="exh-label">Phone Number</label>
        <input className="exh-input" value={accountForm.phone} onChange={e => setAccountForm({ ...accountForm, phone: e.target.value })} />
        <label className="exh-label">Bio</label>
        <textarea className="exh-input exh-textarea" rows={3} value={accountForm.bio} onChange={e => setAccountForm({ ...accountForm, bio: e.target.value })} />
        <button className="exh-btn-primary" style={{ marginTop: 16 }} onClick={saveAccount} disabled={accountBusy}>{accountBusy ? 'Saving…' : 'Save Account'}</button>
      </div>

      <div className="exh-card" style={{ marginTop: 18 }}>
        <h3 className="exh-card-title">Security</h3>
        <label className="exh-label">Current Password</label>
        <input className="exh-input" type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
        <div className="exh-form-row">
          <div><label className="exh-label">New Password</label><input className="exh-input" type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
          <div><label className="exh-label">Confirm New Password</label><input className="exh-input" type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
        </div>
        {pwForm.newPassword && (
          <div className="exh-pwstrength">
            <div className="exh-pwbar"><span style={{ width: `${(pwStrength.score / 4) * 100}%`, background: pwStrength.color }} /></div>
            <span style={{ color: pwStrength.color }}>{pwStrength.label}</span>
          </div>
        )}
        <button className="exh-btn-primary" style={{ marginTop: 16 }} onClick={changePassword} disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Change Password'}</button>
      </div>

      <div className="exh-card" style={{ marginTop: 18 }}>
        <h3 className="exh-card-title">Notification Preferences</h3>
        {[
          ['applicationUpdates', 'Application status updates'],
          ['newMessages', 'New messages'],
          ['expoAnnouncements', 'Expo announcements'],
          ['sessionReminders', 'Session reminders'],
          ['boothAlerts', 'Booth assignment alerts'],
        ].map(([k, label]) => (
          <label key={k} className="exh-toggle-row">
            <span>{label}</span>
            <button type="button" className={`exh-toggle ${prefs[k] ? 'on' : ''}`} onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })}><span /></button>
          </label>
        ))}
        <button className="exh-btn-primary" style={{ marginTop: 16 }} onClick={savePrefs} disabled={prefsBusy}>{prefsBusy ? 'Saving…' : 'Save Preferences'}</button>
      </div>

      <div className="exh-card exh-danger" style={{ marginTop: 18 }}>
        <h3 className="exh-card-title" style={{ color: '#ff80ab' }}>Danger Zone</h3>
        <p className="exh-muted">Deactivating your account hides your profile and applications and signs you out. This can be reversed by an admin.</p>
        <button className="exh-btn-danger" style={{ marginTop: 14 }} onClick={() => { setDeactPw(''); setDeactOpen(true); }}>Deactivate Account</button>
      </div>
    </>
  );

  // ── Skeleton while loading ────────────────────────────────────────────────
  const renderSkeleton = () => (
    <>
      <Skel w="40%" h={34} style={{ marginBottom: 22 }} />
      <div className="exh-stats">
        {[0, 1, 2, 3].map(i => <div key={i} className="exh-stat-card"><Skel w={48} h={48} r={14} /><div style={{ flex: 1 }}><Skel w="50%" h={22} /><Skel w="70%" h={12} style={{ marginTop: 8 }} /></div></div>)}
      </div>
      <div className="exh-grid-2" style={{ marginTop: 18 }}>
        {[0, 1].map(i => <div key={i} className="exh-card"><Skel w="40%" h={18} /><Skel h={90} style={{ marginTop: 14 }} /><Skel w="60%" h={14} style={{ marginTop: 12 }} /></div>)}
      </div>
    </>
  );

  const TABS = {
    overview: renderOverview, applications: renderApplications, booth: renderBooth,
    profile: renderProfile, schedule: renderSchedule, messages: renderMessages,
    analytics: renderAnalytics, settings: renderSettings,
  };

  const companyInitial = (user?.company || user?.name || '?')[0]?.toUpperCase();
  const pendingBanner = !bannerDismissed && pendingApps.length > 0;

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="exh-shell">
      <div className="exh-orb exh-orb-1" />
      <div className="exh-orb exh-orb-2" />

      <div className="exh-mobilebar">
        <button className="exh-burger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
        <span className="exh-mobilebar-title">Exhibitor</span>
      </div>

      <aside className={`exh-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="exh-side-top">
          <div className="exh-side-avatar">{companyInitial}</div>
          <div className="exh-side-company">{user?.company || user?.name}</div>
          {user?.company && <div className="exh-side-uname">{user?.name}</div>}
          <span className="exh-side-role">Exhibitor</span>
          <span className="exh-side-status" style={{ color: isActive ? '#00ff88' : '#ffb300' }}>● {isActive ? 'Active' : 'Pending'}</span>
        </div>

        <nav className="exh-nav">
          {NAV.map(item => (
            <button key={item.key} className={`exh-nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => go(item.key)}>
              <span className="exh-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.key === 'applications' && stats.pending > 0 && <span className="exh-nav-badge pink">{stats.pending}</span>}
              {item.key === 'booth' && activeBooth && <span className="exh-nav-badge">{activeBooth.boothNumber}</span>}
              {item.key === 'messages' && unreadCount > 0 && <span className="exh-nav-badge pink pulse">{unreadCount}</span>}
            </button>
          ))}
        </nav>

        <div className="exh-side-bottom">
          <button className="exh-side-link" onClick={() => setNotifPanel(true)}>🔔 Notifications {notifications.length > 0 && <span className="exh-pill">{notifications.length}</span>}</button>
          <button className="exh-side-link" onClick={() => navigate('/home')}>↩ Back to Home</button>
          <button className="exh-side-link exh-logout" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>

      {sidebarOpen && <div className="exh-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="exh-main">
        {pendingBanner && (
          <div className="exh-banner pending">
            <span>⏳ Your application for <strong>{pendingApps[0].expo?.title}</strong> is under review{pendingApps.length > 1 ? ` (+${pendingApps.length - 1} more)` : ''}</span>
            <button onClick={() => setBannerDismissed(true)}>✕</button>
          </div>
        )}

        {loading ? renderSkeleton() : (
          <div className="exh-tabwrap" key={tab}>
            {tab === 'overview' && boothApps.length > 0 && (
              <div className="exh-banner success">
                🎉 Congratulations! Your application for <strong>{activeBoothApp?.expo?.title}</strong> was approved! Your booth: <strong>{activeBooth?.boothNumber}</strong>
              </div>
            )}
            {TABS[tab]()}
          </div>
        )}
      </main>

      {/* Notifications panel */}
      {notifPanel && (
        <div className="exh-overlay" onClick={() => setNotifPanel(false)}>
          <div className="exh-modal" onClick={e => e.stopPropagation()}>
            <div className="exh-modal-head"><h3>Notifications</h3><button className="exh-modal-x" onClick={() => setNotifPanel(false)}>✕</button></div>
            <div className="exh-modal-body">
              {notifications.length > 0 && <button className="exh-link-btn" style={{ marginBottom: 10 }} onClick={markAllRead}>Mark all as read</button>}
              {notifications.length === 0 ? <p className="exh-muted">No notifications.</p> : (
                <ul className="exh-notif-list">
                  {notifications.map(n => (
                    <li key={n._id} className={`exh-notif ${n.isRead ? '' : 'unread'}`}>
                      <span className="exh-notif-title">{n.title}</span>
                      <span className="exh-notif-msg">{n.message}</span>
                      <span className="exh-notif-time">{ago(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply modal */}
      {applyOpen && (
        <div className="exh-overlay" onClick={() => !applyBusy && setApplyOpen(false)}>
          <div className="exh-modal" onClick={e => e.stopPropagation()}>
            <div className="exh-modal-head"><h3>Apply for Expo</h3><button className="exh-modal-x" onClick={() => setApplyOpen(false)}>✕</button></div>
            <div className="exh-modal-body">
              {applyErr && <div className="exh-error">{applyErr}</div>}
              <label className="exh-label">Select Expo *</label>
              <select className="exh-input exh-sel" value={applyForm.expo} onChange={e => setApplyForm({ ...applyForm, expo: e.target.value })}>
                <option value="">Choose an expo…</option>
                {expos.filter(e => !applications.some(a => a.expo?._id === e._id)).map(e => <option key={e._id} value={e._id}>{e.title}</option>)}
              </select>
              <div className="exh-form-row">
                <div><label className="exh-label">Company Name *</label><input className="exh-input" value={applyForm.companyName} onChange={e => setApplyForm({ ...applyForm, companyName: e.target.value })} placeholder="Your company" /></div>
                <div><label className="exh-label">Category</label><input className="exh-input" value={applyForm.category} onChange={e => setApplyForm({ ...applyForm, category: e.target.value })} placeholder="e.g. Technology" /></div>
              </div>
              <label className="exh-label">Company Description</label>
              <textarea className="exh-input exh-textarea" rows={3} value={applyForm.companyDescription} onChange={e => setApplyForm({ ...applyForm, companyDescription: e.target.value })} />
              <div className="exh-form-row">
                <div><label className="exh-label">Website</label><input className="exh-input" value={applyForm.website} onChange={e => setApplyForm({ ...applyForm, website: e.target.value })} placeholder="https://" /></div>
                <div>
                  <label className="exh-label">Booth Size Preference</label>
                  <select className="exh-input exh-sel" value={applyForm.boothPreference} onChange={e => setApplyForm({ ...applyForm, boothPreference: e.target.value })}>
                    {BOOTH_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <label className="exh-label">Products / Services</label>
              <TagInput tags={applyTags} setTags={setApplyTags} placeholder="Type a product and press Enter…" />
              <label className="exh-label">Special Requirements</label>
              <textarea className="exh-input exh-textarea" rows={2} value={applyForm.notes} onChange={e => setApplyForm({ ...applyForm, notes: e.target.value })} placeholder="Anything the organizer should know…" />
            </div>
            <div className="exh-modal-foot">
              <button className="exh-btn-ghost" onClick={() => setApplyOpen(false)} disabled={applyBusy}>Cancel</button>
              <button className="exh-btn-primary" onClick={submitApply} disabled={applyBusy}>{applyBusy ? 'Submitting…' : 'Submit Application →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div className="exh-overlay" onClick={() => !composeBusy && setComposeOpen(false)}>
          <div className="exh-modal" onClick={e => e.stopPropagation()}>
            <div className="exh-modal-head"><h3>New Message</h3><button className="exh-modal-x" onClick={() => setComposeOpen(false)}>✕</button></div>
            <div className="exh-modal-body">
              <div className="exh-form-row">
                <div>
                  <label className="exh-label">To (organizer)</label>
                  <select className="exh-input exh-sel" value={composeForm.recipient} onChange={e => setComposeForm({ ...composeForm, recipient: e.target.value })}>
                    <option value="">Choose a recipient…</option>
                    {recipients.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="exh-label">Type</label>
                  <select className="exh-input exh-sel" value={composeForm.type} onChange={e => setComposeForm({ ...composeForm, type: e.target.value })}>
                    {MSG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {recipients.length === 0 && <p className="exh-muted" style={{ fontSize: '0.8rem' }}>Apply to an expo first to message its organizer.</p>}
              <label className="exh-label">Subject</label>
              <input className="exh-input" value={composeForm.subject} onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })} placeholder="Subject" />
              <label className="exh-label">Message</label>
              <textarea className="exh-input exh-textarea" rows={4} value={composeForm.content} onChange={e => setComposeForm({ ...composeForm, content: e.target.value })} placeholder="Write your message…" />
            </div>
            <div className="exh-modal-foot">
              <button className="exh-btn-ghost" onClick={() => setComposeOpen(false)} disabled={composeBusy}>Cancel</button>
              <button className="exh-btn-primary" onClick={submitCompose} disabled={composeBusy}>{composeBusy ? 'Sending…' : 'Send Message'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate modal */}
      {deactOpen && (
        <div className="exh-overlay" onClick={() => !deactBusy && setDeactOpen(false)}>
          <div className="exh-modal" onClick={e => e.stopPropagation()}>
            <div className="exh-modal-head"><h3>Deactivate Account</h3><button className="exh-modal-x" onClick={() => setDeactOpen(false)}>✕</button></div>
            <div className="exh-modal-body">
              <div className="exh-error">⚠️ This will sign you out and hide your exhibitor profile. Enter your password to confirm.</div>
              <label className="exh-label">Password</label>
              <input className="exh-input" type="password" value={deactPw} onChange={e => setDeactPw(e.target.value)} />
            </div>
            <div className="exh-modal-foot">
              <button className="exh-btn-ghost" onClick={() => setDeactOpen(false)} disabled={deactBusy}>Cancel</button>
              <button className="exh-btn-danger" onClick={deactivate} disabled={deactBusy}>{deactBusy ? 'Deactivating…' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
