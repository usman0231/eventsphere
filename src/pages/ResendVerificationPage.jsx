import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import Logo from '../components/Logo';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/resend-verification', { email });
      toast.success(data.message);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo-wrap"><Logo /></div>
          <h1 className="auth-title">Resend Verification</h1>
          <p className="auth-subtitle">We'll send a fresh verification link to your email.</p>

          {sent ? (
            <div className="auth-success">
              <p>📬 If that email is registered and unverified, you'll receive a new link.</p>
              <Link to="/login" className="auth-link">← Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">✉️</span>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : 'Send New Link'}
              </button>
            </form>
          )}

          <div className="auth-divider"><span>or</span></div>
          <p className="auth-switch">
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
