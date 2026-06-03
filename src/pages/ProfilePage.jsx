import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/api';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', company: user?.company || '', bio: user?.bio || '' });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateProfile(form);
      toast.success('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return setPwdError('Passwords do not match');
    if (pwdForm.newPassword.length < 6) return setPwdError('Password must be at least 6 characters');
    setPwdLoading(true);
    setPwdError('');
    try {
      await api.put('/api/auth/changepassword', { currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      toast.success('Password changed successfully!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Failed to change password');
    } finally { setPwdLoading(false); }
  };

  const roleColors = { admin: '#7b2ff7', organizer: '#00d4ff', exhibitor: '#ff6b35', attendee: '#ff006e' };
  const roleColor = roleColors[user?.role] || '#7b2ff7';

  return (
    <div className="profile-page">
      <div className="profile-orb profile-orb-1" />
      <div className="profile-orb profile-orb-2" />
      <div className="profile-container">
        <div className="profile-header">
          <p className="profile-tag">Account Settings</p>
          <h1 className="profile-title">My Profile</h1>
          <p className="profile-subtitle">Manage your account information and security</p>
        </div>
        <div className="profile-layout">
          {/* Sidebar */}
          <div className="profile-sidebar">
            <div className="profile-avatar-card">
              <div className="profile-avatar" style={{ background: `linear-gradient(135deg, ${roleColor}, #ff006e)` }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <h3 className="profile-name">{user?.name}</h3>
              <p className="profile-email">{user?.email}</p>
              <span className="profile-role-badge" style={{ background:`${roleColor}20`, color:roleColor, borderColor:`${roleColor}40` }}>
                {user?.role}
              </span>
              {user?.company && <p className="profile-company">🏢 {user.company}</p>}
              {user?.phone && <p className="profile-company">📱 {user.phone}</p>}
            </div>
            <div className="profile-tabs">
              <button className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                👤 Personal Info
              </button>
              <button className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                🔒 Security
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="profile-content">
            {activeTab === 'profile' && (
              <div className="profile-card">
                <h2 className="profile-card-title">Personal Information</h2>
                <p className="profile-card-sub">Update your personal details below</p>
                {error && <div className="profile-error">{error}</div>}
                <form onSubmit={handleProfileUpdate} className="profile-form">
                  <div className="profile-form-row">
                    <div className="profile-form-group">
                      <label className="profile-label">Full Name</label>
                      <input className="profile-input" type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your full name" />
                    </div>
                    <div className="profile-form-group">
                      <label className="profile-label">Phone Number</label>
                      <input className="profile-input" type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+1 234 567 890" />
                    </div>
                  </div>
                  <div className="profile-form-group">
                    <label className="profile-label">Company / Organization</label>
                    <input className="profile-input" type="text" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Your company name" />
                  </div>
                  <div className="profile-form-group">
                    <label className="profile-label">Bio</label>
                    <textarea className="profile-input profile-textarea" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="Tell us a bit about yourself..." rows={4} />
                  </div>
                  <button className="profile-save-btn" type="submit" disabled={loading}>
                    {loading ? <span className="profile-spinner" /> : '💾 Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="profile-card">
                <h2 className="profile-card-title">Change Password</h2>
                <p className="profile-card-sub">Keep your account secure with a strong password</p>
                {pwdError && <div className="profile-error">{pwdError}</div>}
                <form onSubmit={handlePasswordChange} className="profile-form">
                  <div className="profile-form-group">
                    <label className="profile-label">Current Password</label>
                    <input className="profile-input" type="password" value={pwdForm.currentPassword} onChange={e => setPwdForm({...pwdForm, currentPassword: e.target.value})} placeholder="Enter current password" required />
                  </div>
                  <div className="profile-form-row">
                    <div className="profile-form-group">
                      <label className="profile-label">New Password</label>
                      <input className="profile-input" type="password" value={pwdForm.newPassword} onChange={e => setPwdForm({...pwdForm, newPassword: e.target.value})} placeholder="Min 6 characters" required />
                    </div>
                    <div className="profile-form-group">
                      <label className="profile-label">Confirm Password</label>
                      <input className="profile-input" type="password" value={pwdForm.confirmPassword} onChange={e => setPwdForm({...pwdForm, confirmPassword: e.target.value})} placeholder="Repeat new password" required />
                    </div>
                  </div>
                  <button className="profile-save-btn" type="submit" disabled={pwdLoading} style={{ background:'linear-gradient(135deg, #ff006e, #ff6b35)' }}>
                    {pwdLoading ? <span className="profile-spinner" /> : '🔒 Change Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}