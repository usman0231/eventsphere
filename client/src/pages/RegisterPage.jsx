import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Logo from '../components/Logo';
import './AuthPages.css';

const ROLES = [
  { value:'attendee',  label:'Attendee',  icon:'🎟️', desc:'Browse & attend expos' },
  { value:'exhibitor', label:'Exhibitor', icon:'🏪', desc:'Showcase at expos' },
];
// Only attendee & exhibitor can self-register. Organizer/admin are created by an admin / seed.

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirmPassword:'', role:'attendee', company:'', phone:'' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null);

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
        toast.success('Account created — check your email!');
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
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">We sent a verification link to:</p>
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', margin: '8px 0 20px' }}>
              📬 {pendingVerification}
            </p>
            <div className="auth-success">
              <p>Click the link in the email to activate your account. The link expires in 24 hours.</p>
            </div>
            <p className="auth-switch" style={{ marginTop: 16 }}>
              Didn't get it?{' '}
              <Link to="/resend-verification" className="auth-link">Resend link</Link>
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

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrap">
                  <span className="input-icon">👤</span>
                  <input className="form-input" type="text" placeholder="John Doe" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-wrap">
                  <span className="input-icon">✉️</span>
                  <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
              </div>
            </div>
            {form.role === 'exhibitor' && (
              <div className="form-group">
                <label className="form-label">Company / Organization</label>
                <div className="input-wrap">
                  <span className="input-icon">🏢</span>
                  <input className="form-input" type="text" placeholder="Your company name" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <div className="input-wrap">
                  <span className="input-icon">📱</span>
                  <input className="form-input" type="tel" placeholder="+1 234 567 890" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-wrap">
                  <span className="input-icon">🔒</span>
                  <input className="form-input" type={showPwd ? 'text' : 'password'} placeholder="Min 6 characters" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                  <button type="button" className="input-toggle" onClick={() => setShowPwd(!showPwd)}>{showPwd ? '🙈' : '👁️'}</button>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input className="form-input" type={showPwd ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} required />
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