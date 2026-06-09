import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../utils/api';
import Logo from '../components/Logo';
import CodeInput from '../components/CodeInput';

export default function LoginPage() {
  const { login, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const data = await verifyCode(form.email, code.trim());
      toast.success('Email verified — welcome!');
      navigate(homePathForRole(data.user?.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate(homePathForRole(data.user?.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
      // Account exists but the email was never verified — offer a way to resend the link.
      if (err.response?.data?.verificationRequired) setNeedsVerification(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) {
      toast.error('Enter your email above first');
      return;
    }
    setResending(true);
    try {
      const { data } = await api.post('/api/auth/resend-verification', { email: form.email });
      toast.success(data.message || 'A new code has been sent — check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend the link');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo-wrap"><Logo /></div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your EventSphere account</p>
          {error && <div className="auth-error">{error}</div>}
          {needsVerification && (
            <form onSubmit={handleVerify} className="auth-form" style={{ marginBottom: 8 }}>
              <p className="auth-subtitle" style={{ marginBottom: 10 }}>Enter the 6-digit code we emailed you:</p>
              <div className="form-group">
                <CodeInput value={code} onChange={setCode} autoFocus={false} />
              </div>
              <button className="auth-btn" type="submit" disabled={verifying || code.length < 6}>
                {verifying ? <span className="auth-spinner" /> : 'Verify & Continue'}
              </button>
              <p className="auth-switch" style={{ marginTop: 12 }}>
                Didn't get it?{' '}
                <button type="button" className="auth-link" onClick={handleResend} disabled={resending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </p>
            </form>
          )}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="input-wrap">
                <span className="input-icon">✉️</span>
                <input
                  id="login-email"
                  name="email"
                  autoComplete="email"
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  className="form-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Your password"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
                <button type="button" className="input-toggle" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="form-forgot">
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Sign In'}
            </button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}