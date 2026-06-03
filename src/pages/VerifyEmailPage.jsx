import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { homePathForRole } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  // Verification is single-use on the server: hitting it twice consumes the token on the first
  // call and 400s on the second. StrictMode (and any accidental re-mount) would trigger that
  // race, so guard with a ref that survives the double-invoke.
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    (async () => {
      try {
        const { data } = await api.get(`/api/auth/verify-email/${token}`);
        localStorage.setItem('es_token', data.token);
        setStatus('success');
        setMessage(data.message || 'Email verified!');
        toast.success('Email verified — welcome!');
        setTimeout(() => {
          window.location.href = homePathForRole(data.user?.role);
        }, 1200);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed');
      }
    })();
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo-wrap"><Logo /></div>
          <h1 className="auth-title">Email Verification</h1>

          {status === 'verifying' && (
            <>
              <p className="auth-subtitle">Verifying your email…</p>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <span className="auth-spinner" />
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="auth-success">
              <p>✅ {message}</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Redirecting to your dashboard…</p>
            </div>
          )}

          {status === 'error' && (
            <>
              <p className="auth-subtitle">We couldn't verify your email.</p>
              <div className="auth-error">{message}</div>
              <p className="auth-switch" style={{ marginTop: 16 }}>
                Need a new link?{' '}
                <Link to="/resend-verification" className="auth-link">Resend verification</Link>
              </p>
              <p className="auth-switch">
                <Link to="/login" className="auth-link">← Back to login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
