import React from 'react';

// Friendly first-run screen for an organizer who has no expos yet, so the
// dashboard never looks blank. Matches the EventSphere dark theme.
export default function OrganizerEmptyState({ name, onCreate }) {
  return (
    <div className="org-empty">
      <div className="org-empty-orb org-empty-orb-1" />
      <div className="org-empty-orb org-empty-orb-2" />
      <div className="org-empty-card">
        <div className="org-empty-icon">🎪</div>
        <h2 className="org-empty-title">
          {name ? `Welcome, ${name}!` : 'Welcome to your dashboard'}
        </h2>
        <p className="org-empty-sub">
          You haven't created any expos yet. Launch your first event to unlock booths,
          sessions, exhibitor applications and live analytics.
        </p>

        <div className="org-empty-steps">
          <div className="org-empty-step">
            <span className="org-empty-step-num">1</span>
            <span className="org-empty-step-text">Create an expo with dates, venue and ticket price</span>
          </div>
          <div className="org-empty-step">
            <span className="org-empty-step-num">2</span>
            <span className="org-empty-step-text">An admin reviews and approves it to go live</span>
          </div>
          <div className="org-empty-step">
            <span className="org-empty-step-num">3</span>
            <span className="org-empty-step-text">Manage booths, sessions and exhibitor applications</span>
          </div>
        </div>

        <button className="org-empty-cta" onClick={onCreate}>
          ➕ Create Your First Expo
        </button>
        <p className="org-empty-note">Once approved, your expo appears publicly for attendees.</p>
      </div>
    </div>
  );
}
