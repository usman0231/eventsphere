import React, { useState } from 'react';
import './FaqAccordion.css';

const FAQS = [
  {
    q: 'How long does it take to set up my first expo?',
    a: 'Most organizers publish their first expo in under 30 minutes. Upload your floor plan, define booth zones, set pricing tiers, and EventSphere generates the registration flow, exhibitor portal, and attendee schedule automatically.',
  },
  {
    q: 'Can exhibitors pick their own booths?',
    a: 'Yes — exhibitors see the live floor plan in their portal and self-select from booths you mark as available. You can also lock specific booths, require approval, or auto-assign based on company size or tier.',
  },
  {
    q: 'Does EventSphere handle on-site check-in?',
    a: 'Every attendee gets a QR ticket. Use the mobile check-in app to scan badges at entry, individual sessions, or specific booths. Stats stream into your dashboard in real time, so you can spot bottlenecks while the event is running.',
  },
  {
    q: 'How does the AI scheduling assistant work?',
    a: 'It analyzes attendee interests, exhibitor product tags, and session topics to suggest personalized agendas for each attendee. Organizers also get suggested session times that minimize conflicts and maximize attendance.',
  },
  {
    q: 'Is my data secure?',
    a: 'EventSphere is GDPR-ready, encrypts data at rest and in transit, supports SSO on Pro and Enterprise, and is independently penetration-tested. Enterprise plans get a signed DPA and the option of dedicated regional infrastructure.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Monthly plans cancel at the end of the current cycle. Annual plans cancel anytime with a prorated refund for unused months. No "talk to sales to cancel" — you can do it from your billing page.',
  },
  {
    q: 'Do you offer a free trial?',
    a: 'Starter is free forever for one active expo with up to 50 exhibitors. Pro includes a 14-day full-feature trial with no credit card required. Enterprise customers get a guided pilot with a customer success manager.',
  },
];

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className={`faq-item ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="faq-q"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="faq-q-text">{item.q}</span>
        <span className={`faq-icon ${isOpen ? 'is-open' : ''}`} aria-hidden>+</span>
      </button>

      {/* Always rendered; revealed via CSS so the answer reliably shows when open. */}
      <div className="faq-a-wrap">
        <p className="faq-a">{item.a}</p>
      </div>
    </div>
  );
}

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="faq-section">
      <div className="faq-header">
        <div className="faq-tag">Frequently asked</div>
        <h2 className="faq-title">Answers, before you ask</h2>
        <p className="faq-sub">
          Everything you'd want to know before running your first expo on EventSphere.
        </p>
      </div>

      <div className="faq-list">
        {FAQS.map((f, i) => (
          <FaqItem
            key={i}
            item={f}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          />
        ))}
      </div>
    </section>
  );
}
