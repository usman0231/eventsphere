import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Logo from '../components/Logo';
import CodeInput from '../components/CodeInput';

const ROLES = [
  { value:'attendee',  label:'Attendee',  icon:'🎟️', desc:'Browse & attend expos' },
  { value:'exhibitor', label:'Exhibitor', icon:'🏪', desc:'Showcase at expos' },
];
// Only attendee & exhibitor can self-register. Organizer/admin are created by an admin / seed.

export default function RegisterPage() {
  const { register, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirmPassword:'', role:'attendee', company:'', phone:'' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resending, setResending] = useState(false);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    setVerifyError('');
    setVerifying(true);
    try {
      const data = await verifyCode(pendingVerification, code.trim());
      toast.success('Email verified — welcome!');
      navigate(homePathForRole(data.user?.role));
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setVerifyError('');
    setResending(true);
    try {
      const { default: api } = await import('../utils/api');
      await api.post('/api/auth/resend-verification', { email: pendingVerification });
      toast.success('A new code has been sent — check your email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend the code');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const data = await register({ name:form.name, email:form.email, password:form.password, role:form.role, company:form.company, phone:form.phone });
      if (data.verificationRequired) {
        setPendingVerification(form.email);
        toast.success('Account created — check your email for a code!');
      } else {
        toast.success(data.message || 'Account created successfully!');
        navigate(homePathForRole(data.user?.role));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <div className="auth-page">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-logo-wrap"><Logo /></div>
            <h1 className="auth-title">Enter your code</h1>
            <p className="auth-subtitle">We emailed a 6-digit code to:</p>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', margin: '8px 0 20px' }}>
              📬 {pendingVerification}
            </p>
            {verifyError && <div className="auth-error">{verifyError}</div>}
            <form onSubmit={handleVerify} className="auth-form">
              <div className="form-group">
                <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: 10 }}>Verification Code</label>
                <CodeInput value={code} onChange={setCode} autoFocus />
              </div>
              <button className="auth-btn" type="submit" disabled={verifying || code.length < 6}>
                {verifying ? <span className="auth-spinner" /> : 'Verify & Continue'}
              </button>
            </form>
            <p className="auth-switch" style={{ marginTop: 16 }}>
              Didn't get it?{' '}
              <button type="button" className="auth-link" onClick={handleResendCode} disabled={resending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            </p>
            <p className="auth-switch">
              <Link to="/login" className="auth-link">← Back to login</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-card auth-card-wide">
          <div className="auth-logo-wrap"><Logo /></div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join EventSphere today — it's free!</p>
          {error && <div className="auth-error">{error}</div>}

          {/* Role Selector */}
          <div className="role-selector">
            {ROLES.map(r => (
              <div
                key={r.value}
                className={`role-option ${form.role === r.value ? 'active' : ''}`}
                onClick={() => setForm({...form, role: r.value})}
              >
                <span className="role-option-icon">{r.icon}</span>
                <span className="role-option-label">{r.label}</span>
                <span className="role-option-desc">{r.desc}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            {/* Hidden decoys: nudge Chrome to autofill these throwaways instead of the real fields */}
            <input type="text" name="prevent_autofill" autoComplete="off" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <input type="password" name="password_fake" autoComplete="new-password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrap">
                  <span className="input-icon">👤</span>
                  <input className="form-input" type="text" autoComplete="off" placeholder="John Doe" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">✉️</span>
                  <input className="form-input" type="email" autoComplete="off" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
              </div>
            </div>
            {form.role === 'exhibitor' && (
              <div className="form-group">
                <label className="form-label">Company / Organization</label>
                <div className="input-wrap">
                  <span className="input-icon">🏢</span>
                  <input className="form-input" type="text" autoComplete="off" placeholder="Your company name" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <div className="input-wrap">
                  <span className="input-icon">📱</span>
                  <input className="form-input" type="tel" autoComplete="off" placeholder="+1 234 567 890" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <span className="input-icon">🔒</span>
                  <input className="form-input" type={showPwd ? 'text' : 'password'} autoComplete="new-password" placeholder="Min 6 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                  <button type="button" className="input-toggle" onClick={() => setShowPwd(!showPwd)}>{showPwd ? '🙈' : '👁️'}</button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input className="form-input" type={showPwd ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} required />
              </div>
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Create Account'}
            </button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}