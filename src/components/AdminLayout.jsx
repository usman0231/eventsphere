import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

// Sidebar items for the dashboard. `end` makes the index link only match exactly.
// `roles` limits visibility — omitted means every authenticated role sees it.
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', end: true },
  { to: '/dashboard/checkin', label: 'Check-In', icon: '🎟️', roles: ['admin', 'organizer'] },
  { to: '/dashboard/messages', label: 'Messages', icon: '✉️' },
  { to: '/dashboard/users', label: 'Users', icon: '👥', roles: ['admin'] },
  { to: '/dashboard/feedback', label: 'Feedback', icon: '💬', roles: ['admin'] },
  { to: '/dashboard/announce', label: 'Announcements', icon: '📣', roles: ['admin'] },
  { to: '/dashboard/activity', label: 'Activity Log', icon: '🛡️', roles: ['admin'] },
];

// Back-office shell for the admin area. Deliberately does NOT include the public
// marketing chrome (MegaMenu nav, Chatbot) — when you're in /admin you only see
// admin content. (InstallPrompt is rendered globally in pages/_app.jsx instead.)
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Only show nav items this role is allowed to open.
  const navItems = NAV.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <button
          className={`admin-burger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          <span /><span /><span />
        </button>

        <div className="admin-brand" onClick={() => navigate('/dashboard')}>
          <Logo compact />
        </div>

        <div className="admin-topbar-actions">
          {user && (
            <span className="admin-shell-user" title={user.email}>
              <span className="admin-shell-avatar">{user.name?.[0]?.toUpperCase()}</span>
              <span className="admin-shell-uname">{user.name}</span>
            </span>
          )}
          <NavLink to="/home" className="admin-shell-exit" title="Back to the main site">
            ↩ Exit to site
          </NavLink>
          <button className="admin-shell-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
        <nav className="admin-sidenav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-side-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="admin-side-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">EventSphere Admin · v1</div>
      </aside>

      <main className="admin-shell-main">
        <Outlet />
      </main>
    </div>
  );
}
