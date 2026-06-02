import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import './NotificationBell.css';

const TYPE_ICONS = {
  booth_approved: '🎉',
  booth_rejected: '❌',
  message: '✉️',
  session_reminder: '⏰',
  expo_update: '📢',
  application_received: '📋',
  announcement: '📣',
  welcome: '👋',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, setNotifications, unreadCount, setUnreadCount, markAllRead } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fetch notifications on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadNotifications(); }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.log('Could not load notifications');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      markAllRead();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClear = async () => {
    try {
      await api.delete('/api/notifications');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await api.put(`/api/notifications/${notif._id}/read`);
        setNotifications(prev =>
          prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      if (notif.link) {
        navigate(notif.link);
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="nb-wrap" ref={ref}>
      <button className="nb-btn" onClick={() => setOpen(!open)} title="Notifications">
        <span className="nb-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          <div className="nb-top">
            <h4 className="nb-heading">Notifications</h4>
            <div className="nb-top-btns">
              {unreadCount > 0 && (
                <button className="nb-text-btn" onClick={handleMarkAllRead}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button className="nb-text-btn nb-red" onClick={handleClear}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="nb-list">
            {notifications.length === 0 ? (
              <div className="nb-empty">
                <span>🔕</span>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 12).map(n => (
                <div
                  key={n._id}
                  className={`nb-item ${!n.isRead ? 'nb-unread' : ''}`}
                  onClick={() => handleClick(n)}
                >
                  <div className="nb-item-icon">
                    {TYPE_ICONS[n.type] || '🔔'}
                  </div>
                  <div className="nb-item-body">
                    <p className="nb-item-title">{n.title}</p>
                    <p className="nb-item-msg">{n.message}</p>
                    <p className="nb-item-time">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <div className="nb-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}