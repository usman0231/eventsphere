import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import '../AdminPage.css';

export default function AdminAnnouncePage() {
  const [announce, setAnnounce] = useState({ title: '', message: '', role: 'all', link: '' });
  const [sending, setSending] = useState(false);

  const sendAnnouncement = async () => {
    if (!announce.title.trim() || !announce.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    try {
      setSending(true);
      const { data } = await api.post('/api/notifications/announce', announce);
      toast.success(`Announcement sent to ${data.sent} user(s)`);
      setAnnounce({ title: '', message: '', role: 'all', link: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-orb admin-orb-1" />
      <div className="admin-orb admin-orb-2" />
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <p className="admin-tag">Administration</p>
            <h1 className="admin-title">Announcements</h1>
            <p className="admin-subtitle">Broadcast real-time notifications to your users</p>
          </div>
        </div>

        <div className="admin-announce">
          <div className="admin-section-title">📣 Broadcast Announcement</div>
          <p className="admin-announce-hint">Send a real-time notification to users. They'll see a toast and an entry in their bell.</p>
          <div className="admin-announce-grid">
            <div className="admin-form-row">
              <label className="admin-form-label">Audience</label>
              <select className="admin-form-input" value={announce.role} onChange={e => setAnnounce({ ...announce, role: e.target.value })}>
                <option value="all">Everyone</option>
                <option value="attendee">Attendees</option>
                <option value="exhibitor">Exhibitors</option>
                <option value="organizer">Organizers</option>
              </select>
            </div>
            <div className="admin-form-row">
              <label className="admin-form-label">Title</label>
              <input className="admin-form-input" placeholder="System maintenance, new feature, etc." value={announce.title} onChange={e => setAnnounce({ ...announce, title: e.target.value })} />
            </div>
            <div className="admin-form-row admin-form-row-full">
              <label className="admin-form-label">Message</label>
              <textarea className="admin-form-input admin-form-textarea" rows={4} placeholder="What do you want users to know?" value={announce.message} onChange={e => setAnnounce({ ...announce, message: e.target.value })} />
            </div>
            <div className="admin-form-row admin-form-row-full">
              <label className="admin-form-label">Link (optional)</label>
              <input className="admin-form-input" placeholder="/expos/abc123 (where clicking the notif takes the user)" value={announce.link} onChange={e => setAnnounce({ ...announce, link: e.target.value })} />
            </div>
          </div>
          <button className="admin-announce-btn" onClick={sendAnnouncement} disabled={sending}>
            {sending ? 'Broadcasting…' : '📣 Send Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}
