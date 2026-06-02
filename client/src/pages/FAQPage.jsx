import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicShared.css';
import './FAQPage.css';

const CATEGORIES = [
  {
    name: 'Getting Started',
    icon: '🚀',
    items: [
      { q: 'How do I register for EventSphere?', a: 'Click "Get Started" in the top right, choose your role (Attendee or Exhibitor), and fill in your details. You\'ll verify your email, then you\'re in.' },
      { q: 'Is EventSphere free to use?', a: 'Yes — EventSphere is free to use for this deployment, covering expo creation, exhibitor and booth management, attendee registration, and live event tools.' },
      { q: 'Do I need to install anything?', a: 'No installation needed. EventSphere runs in your browser. You can also "Install as App" from the prompt at the bottom of the page to use it like a native app (PWA).' },
    ]
  },
  {
    name: 'Booth Booking',
    icon: '🏢',
    items: [
      { q: 'How do exhibitors book a booth?', a: 'Exhibitors register, browse the expo, open the interactive floor plan, and click an available booth to apply. Organizers review and approve the application, after which the booth is locked to that exhibitor.' },
      { q: 'Can two exhibitors book the same booth?', a: 'No. Once a booth is reserved or approved, it disappears from the available pool in real time across all connected clients via Socket.IO.' },
      { q: 'Can I change my booth after booking?', a: 'You can cancel and re-apply as long as the expo is still in the application phase. Once the organizer closes applications, booth assignments are locked.' },
    ]
  },
  {
    name: 'Tickets & Check-In',
    icon: '🎟️',
    items: [
      { q: 'How do I get my entry ticket?', a: 'After you register for an expo, a QR-coded ticket appears in your dashboard. You can download it as a PNG image or print it directly.' },
      { q: 'How does check-in work at the event?', a: 'Organizers open the Check-In page on any device with a camera and scan attendee QR codes. The system marks attendance instantly and flags duplicate scans.' },
      { q: 'What if my phone dies at the venue?', a: 'Organizers can search attendees by name and check them in manually. Or you can print your ticket beforehand from the download button.' },
    ]
  },
  {
    name: 'Communication',
    icon: '💬',
    items: [
      { q: 'How do I contact an exhibitor?', a: 'Open the expo page, find the exhibitor in the list, and click "Message". You can chat with them in real time from the Messages page.' },
      { q: 'Do I get notifications for session reminders?', a: 'Yes — registered attendees get a notification ~10 minutes before a session starts. Notifications appear in the bell icon and (if enabled) as browser push notifications.' },
    ]
  },
  {
    name: 'Payments & Billing',
    icon: '💳',
    items: [
      { q: 'Do you handle payments?', a: 'This deployment does not process real payments yet. Stripe / PayPal integration for paid tickets and booths is on the roadmap.' },
      { q: 'Can I get a refund?', a: 'Since the demo platform is free, refunds do not apply. For a production deployment, refund policies would be configured per expo by the organizer.' },
    ]
  },
  {
    name: 'Technical Support',
    icon: '🛠️',
    items: [
      { q: "Something isn't working — how do I report a bug?", a: 'Go to the Feedback page from your dashboard and submit a "Bug Report". Include what you were doing, what you expected, and what happened instead.' },
      { q: 'Which browsers are supported?', a: 'Latest Chrome, Edge, Safari, and Firefox. Mobile browsers work too — and you can install EventSphere as a PWA for an app-like experience.' },
      { q: 'Is my data secure?', a: 'Passwords are bcrypt-hashed, sessions use JWT tokens, and all API requests run over HTTPS in production. We never store payment data on our servers.' },
    ]
  },
];

export default function FAQPage() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState('Getting Started-0');

  const toggle = (key) => setOpenKey(prev => (prev === key ? null : key));

  return (
    <div className="pub-page">
      <div className="pub-orb pub-orb-1" />
      <div className="pub-orb pub-orb-2" />

      <div className="pub-container">
        <div className="pub-hero">
          <div className="pub-tag">FAQ</div>
          <h1 className="pub-title">Questions? <span className="pub-gradient">We have answers.</span></h1>
          <div className="pub-divider" />
          <p className="pub-sub">Common questions about registration, booth booking, ticketing, and support. Can't find what you're looking for? <span className="faq-link" onClick={() => navigate('/contact')}>Contact us</span>.</p>
        </div>

        <div className="faq-categories">
          {CATEGORIES.map(cat => (
            <div key={cat.name} className="faq-category">
              <div className="faq-cat-header">
                <span className="faq-cat-icon">{cat.icon}</span>
                <h3 className="faq-cat-title">{cat.name}</h3>
              </div>
              <div className="faq-items">
                {cat.items.map((item, idx) => {
                  const key = `${cat.name}-${idx}`;
                  const isOpen = openKey === key;
                  return (
                    <div key={key} className={`faq-item ${isOpen ? 'open' : ''}`}>
                      <button className="faq-q" onClick={() => toggle(key)}>
                        <span>{item.q}</span>
                        <span className="faq-chevron">{isOpen ? '−' : '+'}</span>
                      </button>
                      <div className="faq-a-wrap">
                        <p className="faq-a">{item.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="faq-cta">
          <h2 className="faq-cta-title">Still need help?</h2>
          <p className="faq-cta-sub">Our team usually responds within a few hours during business days.</p>
          <button className="pub-btn-primary" onClick={() => navigate('/contact')}>Contact Support</button>
        </div>
      </div>
    </div>
  );
}
