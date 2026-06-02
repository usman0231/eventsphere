import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicShared.css';
import './ServicesPage.css';

const SERVICES = [
  {
    icon: '🎯',
    title: 'Expo Management',
    desc: 'Create and run large-scale expos end-to-end — venue setup, exhibitor management, attendee registration, and live operations on the day.',
    features: ['Multi-day events', 'Floor plan upload', 'Capacity tracking', 'Status workflow']
  },
  {
    icon: '🏢',
    title: 'Booth Allocation',
    desc: 'Interactive floor plan with drag-to-assign booths, real-time availability, and conflict detection — no double-bookings.',
    features: ['Visual map', 'Live availability', 'Booth categories', 'Drag & drop assign']
  },
  {
    icon: '📊',
    title: 'Live Analytics',
    desc: 'Real-time dashboards on attendance, booth traffic, session popularity, and exhibitor engagement — exportable to PDF or CSV.',
    features: ['Live charts', 'Custom date ranges', 'PDF export', 'Per-expo breakdowns']
  },
  {
    icon: '💬',
    title: 'Real-Time Messaging',
    desc: 'Socket.IO-powered chat between organizers, exhibitors, and attendees — with typing indicators, read receipts, and threaded conversations.',
    features: ['1:1 & group chat', 'Typing indicators', 'Push notifications', 'Searchable history']
  },
  {
    icon: '🎟️',
    title: 'Ticketing & QR Check-In',
    desc: 'Generate QR-coded tickets attendees can download or print. Organizers scan at the door — entry is verified in under a second.',
    features: ['QR-code tickets', 'Camera scanner', 'Offline-capable', 'Anti-duplicate']
  },
  {
    icon: '📅',
    title: 'Session Scheduling',
    desc: 'Build session schedules with speakers, locations, and capacity limits. Attendees register and receive reminder notifications 10 min before start.',
    features: ['Speaker profiles', 'Auto reminders', 'Calendar export', 'Capacity caps']
  },
  {
    icon: '🏪',
    title: 'Exhibitor Portal',
    desc: 'Dedicated portal where exhibitors register, pick booths, manage company profiles, and respond to attendee inquiries.',
    features: ['Self-service signup', 'Profile builder', 'Product showcase', 'Application status']
  },
  {
    icon: '🔔',
    title: 'Notifications & Alerts',
    desc: 'In-app, email, and real-time socket notifications keep everyone aligned — application approvals, schedule changes, new messages.',
    features: ['In-app bell', 'Email alerts', 'Real-time push', 'Per-user preferences']
  },
  {
    icon: '⭐',
    title: 'Feedback & Reviews',
    desc: 'Collect attendee feedback per session and per expo. Reviews appear on the expo page and aggregate into organizer ratings.',
    features: ['Star ratings', 'Written reviews', 'Per-session feedback', 'Public display']
  },
];

export default function ServicesPage() {
  const navigate = useNavigate();

  return (
    <div className="pub-page">
      <div className="pub-orb pub-orb-1" />
      <div className="pub-orb pub-orb-2" />

      <div className="pub-container">
        <div className="pub-hero">
          <div className="pub-tag">Our Services</div>
          <h1 className="pub-title">Everything you need to run a <span className="pub-gradient">world-class expo</span></h1>
          <div className="pub-divider" />
          <p className="pub-sub">Nine production-ready modules that work together out of the box — no integrations, no plugins, no vendor lock-in.</p>
        </div>

        <div className="services-grid">
          {SERVICES.map(s => (
            <div key={s.title} className="pub-card services-card">
              <div className="services-icon">{s.icon}</div>
              <h3 className="services-title">{s.title}</h3>
              <p className="services-desc">{s.desc}</p>
              <ul className="services-features">
                {s.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="services-cta">
          <h2 className="services-cta-title">Have a custom requirement?</h2>
          <p className="services-cta-sub">We work with enterprise clients to build tailored expo experiences.</p>
          <div className="services-cta-btns">
            <button className="pub-btn-primary" onClick={() => navigate('/contact')}>Contact Sales</button>
          </div>
        </div>
      </div>
    </div>
  );
}
