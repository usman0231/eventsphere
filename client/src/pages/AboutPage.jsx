import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicShared.css';
import './AboutPage.css';

const STATS = [
  { num: '12K+', label: 'Active Exhibitors' },
  { num: '500K+', label: 'Attendees Served' },
  { num: '850+', label: 'Expos Hosted' },
  { num: '98%', label: 'Uptime SLA' },
];

const VALUES = [
  { icon: '🎯', title: 'Mission', desc: 'Empower organizers, exhibitors, and attendees with one unified platform that makes large-scale expos effortless.' },
  { icon: '🔭', title: 'Vision', desc: 'Become the global standard for digital expo management — from local trade shows to international conventions.' },
  { icon: '🤝', title: 'Promise', desc: 'Reliable infrastructure, transparent pricing, real human support, and a product that respects your data.' },
];

const TIMELINE = [
  { year: '2023', title: 'The Idea', desc: 'EventSphere started as a final-year project focused on solving real expo coordination pain points.' },
  { year: '2024', title: 'First Release', desc: 'Launched MVP with booth management, registrations, and live analytics.' },
  { year: '2025', title: 'Scale & Refine', desc: 'Added real-time messaging, ticketing, session reminders, and a notification system.' },
  { year: '2026', title: 'Today', desc: 'Trusted by organizers worldwide. Building toward AI-assisted scheduling and recommendation engines.' },
];

const TEAM = [
  { initials: 'JH', name: 'Jahanzeb Hussain', role: 'Founder & Full-Stack Lead', color: 'linear-gradient(135deg,#6c3de8,#e83d8a)' },
  { initials: 'AM', name: 'Aisha Malik', role: 'Product Design', color: 'linear-gradient(135deg,#00d4ff,#6c3de8)' },
  { initials: 'RK', name: 'Rahul Khan', role: 'Backend Engineer', color: 'linear-gradient(135deg,#ff6b35,#e83d8a)' },
  { initials: 'SN', name: 'Sara Nadeem', role: 'Customer Success', color: 'linear-gradient(135deg,#00d4ff,#00ff88)' },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="pub-page">
      <div className="pub-orb pub-orb-1" />
      <div className="pub-orb pub-orb-2" />
      <div className="pub-orb pub-orb-3" />

      <div className="pub-container">
        <div className="pub-hero">
          <div className="pub-tag">About Us</div>
          <h1 className="pub-title">Building the future of <span className="pub-gradient">expo management</span></h1>
          <div className="pub-divider" />
          <p className="pub-sub">EventSphere is a unified platform that brings organizers, exhibitors, and attendees together — replacing scattered spreadsheets, manual check-ins, and fragmented tools with one elegant system.</p>
        </div>

        <div className="pub-section about-values">
          {VALUES.map(v => (
            <div key={v.title} className="pub-card about-value-card">
              <div className="about-value-icon">{v.icon}</div>
              <h3 className="about-value-title">{v.title}</h3>
              <p className="about-value-desc">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="pub-section">
          <h2 className="pub-section-title">Trusted at scale</h2>
          <p className="pub-section-sub">Numbers from the platform's live deployments</p>
          <div className="about-stats">
            {STATS.map(s => (
              <div key={s.label} className="about-stat">
                <div className="about-stat-num">{s.num}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pub-section">
          <h2 className="pub-section-title">Our journey</h2>
          <p className="pub-section-sub">From a class project to a production platform</p>
          <div className="about-timeline">
            {TIMELINE.map((t, i) => (
              <div key={t.year} className={`about-timeline-item ${i % 2 === 0 ? 'left' : 'right'}`}>
                <div className="about-timeline-dot" />
                <div className="pub-card about-timeline-card">
                  <div className="about-timeline-year">{t.year}</div>
                  <h3 className="about-timeline-title">{t.title}</h3>
                  <p className="about-timeline-desc">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pub-section">
          <h2 className="pub-section-title">Meet the team</h2>
          <p className="pub-section-sub">A small group of builders who care deeply about the craft</p>
          <div className="about-team">
            {TEAM.map(m => (
              <div key={m.name} className="pub-card about-team-card">
                <div className="about-team-avatar" style={{ background: m.color }}>{m.initials}</div>
                <h4 className="about-team-name">{m.name}</h4>
                <p className="about-team-role">{m.role}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pub-section about-cta">
          <h2 className="about-cta-title">Ready to run your next expo?</h2>
          <p className="about-cta-sub">Get started for free — no credit card required.</p>
          <div className="about-cta-btns">
            <button className="pub-btn-primary" onClick={() => navigate('/register')}>Start For Free</button>
            <button className="pub-btn-outline" onClick={() => navigate('/contact')}>Talk to Us</button>
          </div>
        </div>
      </div>
    </div>
  );
}
