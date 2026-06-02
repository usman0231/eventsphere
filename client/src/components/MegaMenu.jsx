import React, { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './MegaMenu.css';

const COLUMNS = [
  {
    heading: 'Manage',
    items: [
      { icon: '🎯', label: 'Expo Management',    desc: 'Create & run multi-hall expos',         to: '/expos' },
      { icon: '📅', label: 'Sessions & Schedule', desc: 'Speakers, rooms, conflicts solved',    hash: '#how-it-works' },
      { icon: '🎟️', label: 'Check-In',           desc: 'QR badges, live entry analytics',      to: '/dashboard/checkin' },
    ],
  },
  {
    heading: 'Engage',
    items: [
      { icon: '🏢', label: 'Exhibitor Portal',  desc: 'Self-serve booths, lead capture',     to: '/exhibitor-portal' },
      { icon: '💬', label: 'Messaging',         desc: 'Real-time chat across roles',         to: '/dashboard/messages' },
      { icon: '⭐', label: 'Feedback',           desc: 'Surveys + NPS in one place',          to: '/feedback' },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { icon: '📊', label: 'Analytics',         desc: 'Live booth traffic & engagement',     to: '/dashboard' },
      { icon: '🤖', label: 'AI Scheduling',      desc: 'Personalized attendee agendas',       hash: '#features' },
      { icon: '🗺️', label: '3D Floor Plan',      desc: 'Walk the expo before it opens',       hash: '#hero' },
    ],
  },
];

export default function MegaMenu({ label = 'Product' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const closeTimer = useRef(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const goHash = (hash) => {
    setOpen(false);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => document.getElementById(hash.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' }), 350);
    } else {
      document.getElementById(hash.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <li
      className="mega-root"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`mega-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <motion.span
          className="mega-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          aria-hidden
        >▾</motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mega-panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            role="menu"
          >
            <div className="mega-grid">
              {COLUMNS.map((col) => (
                <div key={col.heading} className="mega-col">
                  <div className="mega-col-heading">{col.heading}</div>
                  <ul className="mega-col-list">
                    {col.items.map((it) => (
                      <li key={it.label}>
                        {it.hash ? (
                          <button type="button" className="mega-item" onClick={() => goHash(it.hash)} role="menuitem">
                            <span className="mega-item-icon">{it.icon}</span>
                            <span className="mega-item-text">
                              <span className="mega-item-label">{it.label}</span>
                              <span className="mega-item-desc">{it.desc}</span>
                            </span>
                          </button>
                        ) : (
                          <Link to={it.to} className="mega-item" onClick={() => setOpen(false)} role="menuitem">
                            <span className="mega-item-icon">{it.icon}</span>
                            <span className="mega-item-text">
                              <span className="mega-item-label">{it.label}</span>
                              <span className="mega-item-desc">{it.desc}</span>
                            </span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
