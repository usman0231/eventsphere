import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="nf-page">
      <div className="nf-orb nf-orb-1" />
      <div className="nf-orb nf-orb-2" />
      <div className="nf-content">
        <div className="nf-number">404</div>
        <h1 className="nf-title">Page Not Found</h1>
        <p className="nf-sub">The page you are looking for doesn't exist or has been moved.</p>
        <div className="nf-actions">
          <button className="nf-btn-primary" onClick={() => navigate('/')}>🏠 Go Home</button>
          <button className="nf-btn-outline" onClick={() => navigate(-1)}>← Go Back</button>
        </div>
      </div>
    </div>
  );
}