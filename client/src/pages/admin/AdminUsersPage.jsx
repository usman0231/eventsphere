import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import '../AdminPage.css';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userFilter, setUserFilter] = useState({ search: '', role: '' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const { data } = await api.get('/api/auth/users');
      setUsers(data.data || []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/auth/users/${u._id}`);
      toast.success('User deleted');
      setUsers(prev => prev.filter(x => x._id !== u._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleSuspendUser = async (u) => {
    const action = u.isActive === false ? 'activate' : 'suspend';
    if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Activate'} ${u.name}?`)) return;
    try {
      const { data } = await api.put(`/api/auth/users/${u._id}/suspend`, { isActive: u.isActive === false });
      toast.success(data.message);
      setUsers(prev => prev.map(x => x._id === u._id ? data.data : x));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const filteredUsers = users.filter(u => {
    if (userFilter.role && u.role !== userFilter.role) return false;
    if (userFilter.search) {
      const q = userFilter.search.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="admin-page">
      <div className="admin-orb admin-orb-1" />
      <div className="admin-orb admin-orb-2" />
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <p className="admin-tag">Administration</p>
            <h1 className="admin-title">User Management</h1>
            <p className="admin-subtitle">View, suspend, and remove platform accounts</p>
          </div>
        </div>

        <div className="admin-activity">
          <div className="admin-activity-controls">
            <input
              className="admin-form-input"
              placeholder="Search name or email…"
              value={userFilter.search}
              onChange={e => setUserFilter(f => ({ ...f, search: e.target.value }))}
            />
            <select
              className="admin-form-input"
              value={userFilter.role}
              onChange={e => setUserFilter(f => ({ ...f, role: e.target.value }))}
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="organizer">Organizer</option>
              <option value="exhibitor">Exhibitor</option>
              <option value="attendee">Attendee</option>
            </select>
            <button className="admin-export-btn" onClick={loadUsers}>🔄 Refresh</button>
          </div>

          {usersLoading ? (
            <div className="admin-loading">Loading users…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-empty"><span>👥</span><p>No users match the filter.</p></div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const suspended = u.isActive === false;
                    const unverified = u.isEmailVerified === false;
                    const isSelf = currentUser && u._id === currentUser._id;
                    const statusLabel = suspended ? 'suspended' : unverified ? 'unverified' : 'active';
                    const statusColor = suspended
                      ? { bg: 'rgba(255,0,110,0.15)', fg: '#ff80ab', bd: 'rgba(255,0,110,0.3)' }
                      : unverified
                      ? { bg: 'rgba(255,179,0,0.15)', fg: '#ffb300', bd: 'rgba(255,179,0,0.3)' }
                      : { bg: 'rgba(0,255,136,0.15)', fg: '#00ff88', bd: 'rgba(0,255,136,0.3)' };
                    return (
                      <tr key={u._id}>
                        <td className="admin-td-title">
                          {u.name}
                          {isSelf && <span className="admin-role-tag" style={{ marginLeft: 6 }}>you</span>}
                        </td>
                        <td>{u.email}</td>
                        <td><span className="admin-role-tag">{u.role}</span></td>
                        <td>{u.company || <span style={{ opacity: 0.4 }}>—</span>}</td>
                        <td>
                          <span
                            className="admin-status-badge"
                            title={unverified && !suspended ? 'User has not clicked the email verification link yet' : ''}
                            style={{ background: statusColor.bg, color: statusColor.fg, borderColor: statusColor.bd }}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td>{dayjs(u.createdAt).format('MMM D, YYYY')}</td>
                        <td>
                          {u.lastLoginAt
                            ? dayjs(u.lastLoginAt).format('MMM D, HH:mm')
                            : <span style={{ opacity: 0.4 }}>never</span>}
                        </td>
                        <td>
                          {isSelf ? (
                            <span style={{ opacity: 0.5, fontSize: '0.85rem' }} title="Admins cannot suspend or delete their own account">
                              — protected —
                            </span>
                          ) : (
                            <>
                              <button
                                className="admin-export-btn"
                                style={{ marginRight: 8 }}
                                onClick={() => handleSuspendUser(u)}
                                title={suspended ? 'Activate account' : 'Suspend account'}
                              >
                                {suspended ? '✅ Activate' : '🚫 Suspend'}
                              </button>
                              <button
                                className="admin-export-btn"
                                style={{ background: 'rgba(255,0,110,0.15)', borderColor: 'rgba(255,0,110,0.3)', color: '#ff80ab' }}
                                onClick={() => handleDeleteUser(u)}
                                title="Delete user permanently"
                              >
                                🗑️ Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
