import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, animate } from 'framer-motion';
import './LiveNumbersBand.css';

const STATS = [
  { value: 12480, suffix: '+', label: 'Active Exhibitors', accent: '#7b2ff7' },
  { value: 500000, suffix: '+', label: 'Attendees Served', accent: '#ff006e' },
  { value: 98, suffix: '%', label: 'Uptime SLA', accent: '#00d4ff' },
  { value: 3200, suffix: '+', label: 'Expos Hosted', accent: '#ff6b35' },
];

function format(n, target) {
  if (target >= 1000) return Math.round(n).toLocaleString('en-US');
  return Math.round(n).toString();
}

function Counter({ target, suffix, accent, inView }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, target, {
      duration: 2.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(format(v, target)),
    });
    return controls.stop;
  }, [inView, target, mv]);

  return (
    <span className="live-num" style={{ color: accent, textShadow: `0 0 24px ${accent}55` }}>
      {display}{suffix}
    </span>
  );
}

export default function LiveNumbersBand() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section ref={ref} className="live-band">
      <div className="live-band-inner">
        <div className="live-band-header">
          <div className="live-band-tag">
            <span className="live-band-pulse" /> Live across the platform
          </div>
          <h2 className="live-band-title">EventSphere by the numbers</h2>
        </div>

        <div className="live-band-grid">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="live-cell"
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Counter target={s.value} suffix={s.suffix} accent={s.accent} inView={inView} />
              <span className="live-label">{s.label}</span>
              <span className="live-underline" style={{ background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)` }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
