import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

export default function MessagesPage() {
  const [tab, setTab] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ recipient:'', subject:'', content:'', type:'general' });

  useEffect(() => { fetchMessages(); }, []);

  const fetchMessages = async () => {
    try {
      const [inboxRes, sentRes] = await Promise.all([api.get('/api/messages/inbox'), api.get('/api/messages/sent')]);
      setInbox(inboxRes.data.data);
      setSent(sentRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    try {
      await api.post('/api/messages', form);
      toast.success('Message sent!');
      setDialog(false);
      setForm({ recipient:'', subject:'', content:'', type:'general' });
      fetchMessages();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/messages/${id}`);
    toast.success('Deleted');
    fetchMessages();
  };

  const handleMarkRead = async (id) => {
    await api.put(`/api/messages/${id}/read`);
    fetchMessages();
  };

  const messages = tab === 'inbox' ? inbox : sent;
  const unread = inbox.filter(m => !m.isRead).length;

  return (
    <div className="msg-page">
      <div className="msg-orb msg-orb-1" />
      <div className="msg-orb msg-orb-2" />
      <div className="msg-container">
        <div className="msg-header">
          <div>
            <p className="msg-tag">Communication</p>
            <h1 className="msg-title">Messages</h1>
            <p className="msg-subtitle">Communicate with organizers and exhibitors</p>
          </div>
          <button className="msg-compose-btn" onClick={() => setDialog(true)}>✉️ Compose</button>
        </div>

        <div className="msg-tabs">
          <button className={`msg-tab ${tab === 'inbox' ? 'active' : ''}`} onClick={() => setTab('inbox')}>
            📥 Inbox {unread > 0 && <span className="msg-badge">{unread}</span>}
          </button>
          <button className={`msg-tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>
            📤 Sent
          </button>
        </div>

        {loading ? (
          <div className="msg-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="msg-empty">
            <span>📭</span>
            <h3>{tab === 'inbox' ? 'Your inbox is empty' : 'No sent messages'}</h3>
            <p>Messages from organizers and exhibitors will appear here</p>
          </div>
        ) : (
          <div className="msg-list">
            {messages.map(msg => (
              <div key={msg._id} className={`msg-item ${!msg.isRead && tab === 'inbox' ? 'unread' : ''}`}>
                <div className="msg-avatar">
                  {tab === 'inbox' ? msg.sender?.name?.[0]?.toUpperCase() : msg.recipient?.name?.[0]?.toUpperCase()}
                </div>
                <div className="msg-item-content">
                  <div className="msg-item-header">
                    <div className="msg-item-from">
                      {tab === 'inbox' ? `From: ${msg.sender?.name}` : `To: ${msg.recipient?.name}`}
                    </div>
                    <div className="msg-item-meta">
                      <span className="msg-type-badge">{msg.type}</span>
                      {!msg.isRead && tab === 'inbox' && <span className="msg-new-badge">New</span>}
                      <span className="msg-date">{dayjs(msg.createdAt).format('MMM D, h:mm A')}</span>
                    </div>
                  </div>
                  {msg.subject && <div className="msg-subject">{msg.subject}</div>}
                  <div className="msg-body">{msg.content}</div>
                  <div className="msg-actions">
                    {!msg.isRead && tab === 'inbox' && (
                      <button className="msg-action-btn" onClick={() => handleMarkRead(msg._id)}>✓ Mark Read</button>
                    )}
                    <button className="msg-action-btn msg-delete-btn" onClick={() => handleDelete(msg._id)}>🗑️ Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPOSE DIALOG */}
      {dialog && (
        <div className="msg-dialog-overlay" onClick={() => setDialog(false)}>
          <div className="msg-dialog" onClick={e => e.stopPropagation()}>
            <div className="msg-dialog-header">
              <h3>New Message</h3>
              <button className="msg-dialog-close" onClick={() => setDialog(false)}>✕</button>
            </div>
            <div className="msg-dialog-body">
              <div className="msg-form-group">
                <label className="msg-label">Recipient User ID</label>
                <input className="msg-input" placeholder="Paste recipient user ID" value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})} />
              </div>
              <div className="msg-form-group">
                <label className="msg-label">Type</label>
                <select className="msg-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  {['general','inquiry','support','collaboration'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="msg-form-group">
                <label className="msg-label">Subject (optional)</label>
                <input className="msg-input" placeholder="Message subject" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
              </div>
              <div className="msg-form-group">
                <label className="msg-label">Message</label>
                <textarea className="msg-input msg-textarea" rows={5} placeholder="Type your message..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
              </div>
            </div>
            <div className="msg-dialog-footer">
              <button className="msg-cancel-btn" onClick={() => setDialog(false)}>Cancel</button>
              <button className="msg-send-btn" onClick={handleSend}>Send Message →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}