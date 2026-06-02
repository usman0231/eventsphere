import React from 'react';
import { motion } from 'framer-motion';
import './TestimonialsMarquee.css';

const TESTIMONIALS = [
  { quote: "EventSphere cut our booth assignment time from days to minutes. Real-time visibility changed how we run shows.", author: "Sarah Chen", role: "Operations Director, TechExpo Asia", color: "#7b2ff7" },
  { quote: "The exhibitor portal alone justified the entire migration. Our partners love the live lead tracking.", author: "Marcus Bell", role: "VP Events, GlobalTrade", color: "#00d4ff" },
  { quote: "Finally a platform that respects both organizers and attendees. The 3D floor plan is genuinely useful, not a gimmick.", author: "Priya Nair", role: "Founder, IndiaCon", color: "#ff006e" },
  { quote: "We've doubled exhibitor renewals since switching. The analytics are addictive.", author: "Thomas Krüger", role: "Director, Berlin Innovation Week", color: "#ff6b35" },
  { quote: "Onboarding 200 exhibitors in a single weekend would have been impossible before EventSphere.", author: "Aisha Mahmood", role: "Producer, MENA Summit", color: "#a855f7" },
  { quote: "The live dashboards make stakeholder reporting trivial. I screenshot one panel and the board gets it.", author: "Diego Ramos", role: "CMO, LatamFair", color: "#22d3ee" },
];

function Card({ t }) {
  return (
    <div className="testi-card">
      <div className="testi-quote-mark" style={{ color: t.color }}>"</div>
      <p className="testi-quote">{t.quote}</p>
      <div className="testi-author-row">
        <div className="testi-avatar" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}88)` }}>
          {t.author.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </div>
        <div>
          <div className="testi-author">{t.author}</div>
          <div className="testi-role">{t.role}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ items, reverse = false, duration = 40 }) {
  // duplicate the list so the seamless loop has content on both sides
  const doubled = [...items, ...items];
  return (
    <div className={`testi-row ${reverse ? 'testi-row-reverse' : ''}`}>
      <div
        className="testi-track"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {doubled.map((t, i) => <Card key={i} t={t} />)}
      </div>
    </div>
  );
}

export default function TestimonialsMarquee() {
  const rowA = TESTIMONIALS;
  const rowB = [...TESTIMONIALS].reverse();

  return (
    <section className="testi-section">
      <motion.div
        className="testi-header"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="testi-tag">Trusted globally</div>
        <h2 className="testi-title">Built for the world's most demanding events</h2>
        <p className="testi-sub">
          From regional summits to multi-hall trade shows — EventSphere powers organizers across six continents.
        </p>
      </motion.div>

      <Row items={rowA} duration={50} />
      <Row items={rowB} reverse duration={60} />
    </section>
  );
}
