import React from 'react';

// Coded EventSphere logo: orbit-planet mark + "Event Sphere" wordmark.
// `compact` shows just the mark + wordmark (for nav bars); the full form
// adds the subtitle + tagline (for auth screens).
export default function Logo({ compact = false, className = '' }) {
  return (
    <span className={`es-logo ${compact ? 'es-logo--compact' : ''} ${className}`}>
      <svg className="es-logo-mark" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="esPlanet" x1="22" y1="24" x2="78" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9b5cff" />
            <stop offset="0.55" stopColor="#7b2ff7" />
            <stop offset="1" stopColor="#ff006e" />
          </linearGradient>
          <linearGradient id="esOrbit" x1="8" y1="72" x2="92" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00d4ff" />
            <stop offset="0.5" stopColor="#7b2ff7" />
            <stop offset="1" stopColor="#ff006e" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="50" rx="45" ry="18" transform="rotate(-28 50 50)" stroke="url(#esOrbit)" strokeWidth="2.5" opacity="0.9" />
        <circle cx="50" cy="50" r="21" fill="url(#esPlanet)" />
        <ellipse cx="43" cy="42" rx="8" ry="5" fill="#fff" opacity="0.22" />
        <circle cx="86" cy="31" r="3.2" fill="#00d4ff" />
        <circle cx="14" cy="69" r="3.2" fill="#ff006e" />
      </svg>

      <span className="es-logo-text">
        <span className="es-logo-word">
          <span className="es-logo-event">Event</span>
          <span className="es-logo-sphere">Sphere</span>
        </span>
        {!compact && <span className="es-logo-sub">Expo Management Platform</span>}
        {!compact && <span className="es-logo-tag">Where connections happen</span>}
      </span>
    </span>
  );
}
