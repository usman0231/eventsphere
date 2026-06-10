import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import Chatbot from './Chatbot';
import MegaMenu from './MegaMenu';
import Logo from './Logo';

export default function Layout() {
  const { user, logout, isOrganizer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isHome = location.pathname === '/';
  const hideNav = location.pathname === '/login';
  const hideChatbot =
    location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);

    window.addEventListener('scroll', onScroll);

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const scrollTo = (id) => {
    if (location.pathname !== '/') {
      navigate('/');

      setTimeout(() => {
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="app-root">
      {!hideNav && (
      <nav className={`nav ${scrolled || !isHome ? 'scrolled' : ''}`}>
        
        <div
          className="logo"
          onClick={() => navigate('/')}
        >
          <Logo compact />
        </div>

        <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>

          {!user && <MegaMenu label="Product" />}

          {isHome && (
            <>
              <li>
                <a
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo('faq');
                  }}
                >
                  FAQ
                </a>
              </li>
            </>
          )}

          <li>
            <Link to="/services">Services</Link>
          </li>

          <li>
            <Link to="/expos">Expos</Link>
          </li>

          <li>
            <Link to="/about">About</Link>
          </li>

          <li>
            <Link to="/contact">Contact</Link>
          </li>

          {user && user.role !== 'attendee' && (
            <li>
              <Link to="/dashboard">Dashboard</Link>
            </li>
          )}

          {user && isOrganizer && (
            <li>
              <Link to="/expos/create">Create Expo</Link>
            </li>
          )}

          {user && isOrganizer && (
            <li>
              <Link to="/dashboard/checkin">🎟️ Check-In</Link>
            </li>
          )}

          {user && user.role !== 'attendee' && (
            <li>
              <Link to="/dashboard/messages">Messages</Link>
            </li>
          )}

          {user?.role === 'exhibitor' && (
            <li>
              <Link to="/exhibitor-portal">My Portal</Link>
            </li>
          )}
        </ul>

        <div className="nav-actions">
          {user ? (
            <div className="user-menu">

              <NotificationBell />

              <div
                className="user-avatar"
                onClick={() => navigate('/profile')}
                title={user.name}
              >
                {user.name?.[0]?.toUpperCase()}
              </div>

              <button
                className="btn-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                className="btn-login"
                onClick={() => navigate('/login')}
              >
                Login
              </button>

              <button
                className="nav-cta"
                onClick={() => navigate('/register')}
              >
                Get Started →
              </button>
            </>
          )}
        </div>

        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
      )}

      <main>
        <Outlet />
      </main>

      {!hideChatbot && <Chatbot />}
    </div>
  );
}