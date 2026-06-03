import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExperienceHUD({
  waypoints,
  activeWaypoint,
  onWaypointSelect,
  attendees = 0,
  selected = null,
  onClearSelection,
  onExit,
  expoSelector = null,
}) {
  return (
    <div className="exp-hud">
      {/* TOP BAR */}
      <div className="exp-hud-top">
        <div className="exp-hud-top-left">
          <span className="exp-hud-dot" />
          <span className="exp-hud-label">EventSphere · Live Ops</span>
          <span className="exp-hud-sep">/</span>
          <span className="exp-hud-status">Immersive Mode</span>
        </div>
        <div className="exp-hud-top-right">
          {expoSelector}
          <button className="exp-hud-exit" onClick={onExit}>← Exit</button>
        </div>
      </div>

      {/* LEFT TELEMETRY */}
      <div className="exp-hud-left">
        <TelemetryBlock label="Active attendees" value={attendees} accent="#00d4ff" />
        <TelemetryBlock label="Halls online" value="2 / 2" accent="#00ff88" />
        <TelemetryBlock label="Booths" value="12" accent="#7b2ff7" />
        <TelemetryBlock label="Network density" value="78%" accent="#ff006e" suffix="" />
      </div>

      {/* RIGHT MINIMAP */}
      <div className="exp-hud-right">
        <div className="exp-hud-card">
          <div className="exp-hud-card-label">Floor Plan</div>
          <svg viewBox="0 0 100 100" className="exp-hud-map">
            <rect x="6" y="14" width="36" height="72" rx="2"
              fill="rgba(0,212,255,0.08)" stroke="rgba(0,212,255,0.6)" strokeWidth="0.5" />
            <rect x="58" y="14" width="36" height="72" rx="2"
              fill="rgba(255,0,110,0.08)" stroke="rgba(255,0,110,0.6)" strokeWidth="0.5" />
            <text x="24" y="52" textAnchor="middle" fill="#00d4ff" fontSize="6" fontFamily="DM Sans">A</text>
            <text x="76" y="52" textAnchor="middle" fill="#ff80ab" fontSize="6" fontFamily="DM Sans">B</text>
            <line x1="50" y1="14" x2="50" y2="86" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4" strokeDasharray="2 2" />
          </svg>
          <div className="exp-hud-card-hint">A · West Hall · 6 booths<br />B · East Hall · 6 booths</div>
        </div>
      </div>

      {/* BOTTOM WAYPOINT BAR */}
      <div className="exp-hud-bottom">
        <div className="exp-hud-waypoints">
          {waypoints.map((w) => (
            <button
              key={w.id}
              className={`exp-wp ${activeWaypoint === w.id ? 'is-active' : ''}`}
              onClick={() => onWaypointSelect(w.id)}
            >
              <span className="exp-wp-icon">{w.icon}</span>
              <span className="exp-wp-label">{w.label}</span>
            </button>
          ))}
        </div>
        <div className="exp-hud-hint">
          Drag to look · Click any attendee to inspect their network
        </div>
      </div>

      {/* SELECTED ATTENDEE CARD */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="exp-selected"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="exp-selected-head">
              <div className="exp-selected-avatar" style={{ background: selected.color }}>
                {selected.initials}
              </div>
              <div>
                <div className="exp-selected-name">{selected.name}</div>
                <div className="exp-selected-role">{selected.role}</div>
              </div>
              <button className="exp-selected-close" onClick={onClearSelection}>✕</button>
            </div>
            <div className="exp-selected-body">
              <div className="exp-selected-row">
                <span>Visited booths</span>
                <strong>{selected.visited}</strong>
              </div>
              <div className="exp-selected-row">
                <span>Connections</span>
                <strong>{selected.connections}</strong>
              </div>
              <div className="exp-selected-row">
                <span>Interests</span>
                <strong>{selected.interests.join(' · ')}</strong>
              </div>
              <div className="exp-selected-link">
                <span className="exp-link-pulse" />
                Networking link rendered in scene
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner crosshair / vignette */}
      <Crosshair />
    </div>
  );
}

function TelemetryBlock({ label, value, accent }) {
  return (
    <div className="exp-tel">
      <div className="exp-tel-label">{label}</div>
      <div className="exp-tel-value" style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}>
        {value}
      </div>
      <div className="exp-tel-bar" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
    </div>
  );
}

function Crosshair() {
  return (
    <>
      <svg className="exp-corner exp-corner-tl" viewBox="0 0 30 30" aria-hidden>
        <path d="M2 12 V2 H12" fill="none" stroke="#00d4ff" strokeWidth="1.2" />
      </svg>
      <svg className="exp-corner exp-corner-tr" viewBox="0 0 30 30" aria-hidden>
        <path d="M18 2 H28 V12" fill="none" stroke="#00d4ff" strokeWidth="1.2" />
      </svg>
      <svg className="exp-corner exp-corner-bl" viewBox="0 0 30 30" aria-hidden>
        <path d="M2 18 V28 H12" fill="none" stroke="#00d4ff" strokeWidth="1.2" />
      </svg>
      <svg className="exp-corner exp-corner-br" viewBox="0 0 30 30" aria-hidden>
        <path d="M28 18 V28 H18" fill="none" stroke="#00d4ff" strokeWidth="1.2" />
      </svg>
    </>
  );
}
