import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const MILESTONES = [
  {
    period: 'Q1 2026',
    status: 'shipped',
    title: 'Real-time Floor Plans',
    body: 'Live booth allocation, drag-and-drop layouts, and shared cursors for organizer teams.',
    icon: '🗺️',
  },
  {
    period: 'Q2 2026',
    status: 'shipped',
    title: '3D Expo Visualization',
    body: 'Walk the floor in 3D before doors open. Hover any booth for live occupancy and leads.',
    icon: '🌐',
  },
  {
    period: 'Q3 2026',
    status: 'building',
    title: 'AI Scheduling Assistant',
    body: 'Personalized attendee agendas, optimized session timings, and conflict resolution.',
    icon: '🤖',
  },
  {
    period: 'Q4 2026',
    status: 'next',
    title: 'Lead Intelligence',
    body: 'Cross-event attendee profiles, exhibitor CRM sync, and warm-lead scoring.',
    icon: '🎯',
  },
  {
    period: '2027',
    status: 'future',
    title: 'AR Wayfinding',
    body: 'Phone-camera navigation across the show floor with live session reminders.',
    icon: '🧭',
  },
  {
    period: '2027+',
    status: 'future',
    title: 'Global Expo Network',
    body: 'A federated layer so attendees discover relevant booths across every EventSphere expo.',
    icon: '🛰️',
  },
];

const STATUS_LABEL = {
  shipped: 'Shipped',
  building: 'Building',
  next: 'Next up',
  future: 'Future',
};

function MilestoneCard({ m, side, index }) {
  return (
    <motion.div
      className={`rm-card rm-card-${side} rm-status-${m.status}`}
      initial={{ opacity: 0, x: side === 'left' ? -60 : 60, y: 20 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.7,
        delay: 0.05 + index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="rm-period">{m.period}</div>
      <div className="rm-status-badge">
        <span className="rm-status-dot" />
        {STATUS_LABEL[m.status]}
      </div>
      <h3 className="rm-title">
        <span className="rm-icon" aria-hidden>{m.icon}</span>
        {m.title}
      </h3>
      <p className="rm-body">{m.body}</p>
    </motion.div>
  );
}

function Node({ m, index }) {
  return (
    <motion.div
      className={`rm-node rm-status-${m.status}`}
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay: 0.1 + index * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
    >
      <span className="rm-node-pulse" />
    </motion.div>
  );
}

export default function RoadmapTimeline() {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start 65%', 'end 35%'],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const smoothLine = useSpring(lineHeight, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <section id="roadmap" className="rm-section">
      <motion.div
        className="rm-header"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rm-tag">Where we're going</div>
        <h2 className="rm-title-main">Roadmap to the future of expos</h2>
        <p className="rm-sub">
          Public commitments, in priority order. What we've shipped, what we're building right now,
          and what's next.
        </p>
      </motion.div>

      <div className="rm-rail" ref={wrapRef}>
        <div className="rm-spine">
          <motion.div className="rm-spine-fill" style={{ height: smoothLine }} />
        </div>

        <div className="rm-rows">
          {MILESTONES.map((m, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            return (
              <div key={i} className="rm-row">
                {side === 'left' ? <MilestoneCard m={m} side="left" index={i} /> : <div className="rm-spacer" />}
                <Node m={m} index={i} />
                {side === 'right' ? <MilestoneCard m={m} side="right" index={i} /> : <div className="rm-spacer" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
