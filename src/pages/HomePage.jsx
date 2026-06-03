/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useRef, Suspense, lazy } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import LiveNumbersBand from '../components/LiveNumbersBand';
import TestimonialsMarquee from '../components/TestimonialsMarquee';
import LogoStrip from '../components/LogoStrip';
import FaqAccordion from '../components/FaqAccordion';
import HeroBackground from '../components/HeroBackground';
import RoadmapTimeline from '../components/RoadmapTimeline';

// Lazy-load the 3D scene so three.js / R3F / drei don't bloat the initial bundle
const BoothFloor3D = lazy(() => import('../components/BoothFloor3D'));

const FEATURES = [
  { icon:"🎯", cls:"purple", title:"Expo Management", desc:"Create, edit, and manage large-scale expo events with real-time floor plan allocation and booth management." },
  { icon:"📊", cls:"cyan", title:"Analytics Dashboard", desc:"Live analytics on attendee engagement, booth traffic, session popularity, and comprehensive reporting." },
  { icon:"🏢", cls:"pink", title:"Exhibitor Portal", desc:"Full exhibitor lifecycle — register, select booths on interactive maps, manage profiles and products showcased." },
  { icon:"📅", cls:"orange", title:"Schedule Management", desc:"Dynamic session scheduling with speaker assignments, location management, and real-time attendee notifications." },
  { icon:"🔒", cls:"green", title:"Secure Authentication", desc:"Role-based access control with encrypted storage, GDPR compliance, and industry-standard security protocols." },
  { icon:"💬", cls:"gold", title:"Real-time Communication", desc:"Integrated messaging between organizers, exhibitors, and attendees with instant notifications and reminders." },
];

const STEPS = [
  { title:"Create Your Account", desc:"Sign up as an organizer, exhibitor, or attendee. Each role gets a tailored onboarding experience and dashboard." },
  { title:"Set Up Your Expo", desc:"Configure event details, upload floor plans, allocate booth spaces, and publish your event in minutes." },
  { title:"Manage Registrations", desc:"Review exhibitor applications, approve bookings, assign booths, and communicate with participants seamlessly." },
  { title:"Go Live & Engage", desc:"Launch your expo with real-time updates, live analytics, session reminders, and attendee engagement tools." },
];

const ROLES = [
  { cls:"admin", badge:"admin", emoji:"🎛️", title:"Organizer", desc:"Full control over expos — create events, manage exhibitors, assign booths, and access comprehensive analytics." },
  { cls:"exhibitor", badge:"exhibitor", emoji:"🏪", title:"Exhibitor", desc:"Register for expos, choose your booth on live floor plans, showcase products, and connect with attendees." },
  { cls:"attendee", badge:"attendee", emoji:"🎟️", title:"Attendee", desc:"Discover expos, browse exhibitors, register for sessions, and personalize your event experience." },
];

function Particles() {
  const COLORS = ["#7b2ff7","#ff006e","#00d4ff","#ff6b35","#a855f7"];
  return (
    <div className="particles-wrap">
      {Array.from({length:20}).map((_,i) => {
        const dx = (Math.random()-0.5)*400;
        const duration = 10+Math.random()*15;
        const delay = Math.random()*20;
        const left = Math.random()*100;
        const size = 2+Math.random()*3;
        const color = COLORS[i%COLORS.length];
        return (
          <div key={i} className="particle" style={{
            left:`${left}%`,
            width:`${size}px`,
            height:`${size}px`,
            background: color,
            animation:`particleFloat ${duration}s ${delay}s linear infinite`,
            '--dx':`${dx}px`,
          }} />
        );
      })}
    </div>
  );
}

// Scroll progress bar pinned to the top of the page
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  return <motion.div className="scroll-progress" style={{ scaleX }} />;
}

// Word-by-word staggered reveal for the hero headline
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const wordVariants = {
  hidden: { y: 28, opacity: 0, filter: 'blur(8px)' },
  show: { y: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function StaggeredText({ text, className }) {
  return (
    <motion.span
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ display: 'inline-block' }}
    >
      {text.split(' ').map((w, i) => (
        <motion.span key={i} variants={wordVariants} style={{ display: 'inline-block', marginRight: '0.3em' }}>
          {w}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Cards / sections fade-up with a slight pop using whileInView
const fadeUp = {
  hidden: { opacity: 0, y: 50 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

// Hero stats parallax-on-scroll
function HeroVisual() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0.2]);
  return (
    <motion.div ref={ref} className="hero-visual" style={{ y, opacity }}>
      <div className="hero-card-main">
        {[["12K+","Active Exhibitors"],["98%","Uptime SLA"],["500K+","Attendees Served"]].map(([n,l], i) => (
          <motion.div
            key={l}
            className="stat-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
          >
            <div className="stat-num">{n}</div>
            <div className="stat-label">{l}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });

  return (
    <div className="home-page">
      <ScrollProgress />

      {/* CINEMATIC ANIMATED HERO BACKGROUND */}
      <HeroBackground />

      {/* ORB BACKGROUNDS (kept on top of mesh for added depth) */}
      <div className="orb-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <Particles />

      {/* HERO */}
      <section id="hero" className="hero">
        <div className="hero-inner">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span className="hero-badge-dot" />
            Live on EventSphere Platform
          </motion.div>

          <h1 className="hero-title">
            <StaggeredText className="line1" text="The Future of" />
            <span className="gradient-text">
              <StaggeredText className="" text="Expo Management" />
            </span>
          </h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
          >
            Unify organizers, exhibitors, and attendees in one powerful platform. Real-time analytics, smart booth allocation, and seamless communication — all in one place.
          </motion.p>

          <motion.div
            className="hero-btns"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6 }}
          >
            {user ? (
              user.role === 'attendee' ? (
                <motion.button
                  className="btn-primary"
                  onClick={() => navigate('/expos')}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Browse Expos →
                </motion.button>
              ) : (
                <motion.button
                  className="btn-primary"
                  onClick={() => navigate('/dashboard')}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Go to Dashboard →
                </motion.button>
              )
            ) : (
              <>
                <motion.button
                  className="btn-primary"
                  onClick={() => navigate('/register')}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Start For Free
                </motion.button>
                <motion.button
                  className="btn-outline"
                  onClick={() => scrollTo('how-it-works')}
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  See How It Works
                </motion.button>
              </>
            )}
            <motion.button
              className="btn-outline"
              onClick={() => navigate('/experience')}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                borderColor: 'rgba(0,212,255,0.5)',
                color: '#00d4ff',
                background: 'rgba(0,212,255,0.08)',
              }}
            >
              ◆ Launch 3D Experience
            </motion.button>
          </motion.div>

          <HeroVisual />
        </div>
      </section>

      {/* TRUSTED-BY LOGO STRIP */}
      <LogoStrip />

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="container">
          <motion.div
            className="section-tag"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >Platform Features</motion.div>
          <motion.h2
            className="section-title"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >Everything You Need</motion.h2>
          <motion.div
            className="divider"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          />
          <motion.p
            className="section-sub"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >From booth allocation to real-time analytics, EventSphere provides every tool you need to run world-class expos.</motion.p>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="feature-card"
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
              >
                <div className={`feat-icon ${f.cls}`}>{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3D BOOTH FLOOR PREVIEW (lazy) */}
      <Suspense fallback={<div className="booth3d-fallback">Loading 3D floor…</div>}>
        <BoothFloor3D />
      </Suspense>

      {/* LIVE NUMBERS BAND */}
      <LiveNumbersBand />

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section" style={{ paddingTop: 60 }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom: 60 }}>
            <motion.div
              className="section-tag"
              initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
            >Process</motion.div>
            <motion.h2
              className="section-title"
              initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
            >How It Works</motion.h2>
            <motion.div
              className="divider"
              initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
              style={{ margin:'16px auto' }}
            />
          </div>
          <div className="steps-wrap">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                className="step"
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUp}
              >
                <div className="step-num">{String(i+1).padStart(2,'0')}</div>
                <div className="step-content">
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="section">
        <div className="container">
          <motion.div
            className="section-tag"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >User Roles</motion.div>
          <motion.h2
            className="section-title"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >Built for Everyone</motion.h2>
          <motion.div
            className="divider"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          />
          <motion.p
            className="section-sub"
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={fadeUp}
          >EventSphere provides tailored experiences for each stakeholder in the expo ecosystem.</motion.p>

          <div className="roles-grid">
            {ROLES.map((r, i) => (
              <motion.div
                key={i}
                className={`role-card ${r.cls}`}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                variants={fadeUp}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
              >
                <div className="role-card-inner">
                  <span className={`role-badge ${r.badge}`}>{r.badge}</span>
                  <span className="role-emoji">{r.emoji}</span>
                  <div className="role-title">{r.title}</div>
                  <div className="role-desc">{r.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <FaqAccordion />

      {/* ROADMAP TIMELINE */}
      <RoadmapTimeline />

      {/* TESTIMONIALS MARQUEE */}
      <TestimonialsMarquee />

      {/* CTA */}
      <section id="cta" className="cta-section">
        <div className="container">
          <motion.div
            className="cta-box"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <h2 className="cta-title">Ready to Transform Your Expo?</h2>
            <p className="cta-sub">Join thousands of organizers already using EventSphere to deliver unforgettable event experiences.</p>
            <div className="hero-btns">
              <motion.button
                className="btn-primary"
                onClick={() => navigate('/register')}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >Start Free Trial</motion.button>
              <motion.button
                className="btn-outline"
                onClick={() => navigate('/expos')}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >Book a Demo</motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">EventSphere</div>
              <p className="footer-tagline">The all-in-one platform for world-class expo and trade show management.</p>
              <div className="footer-contact-row">
                <a href="mailto:hello@eventsphere.app" className="footer-contact-line">📧 hello@eventsphere.app</a>
                <a href="tel:+923001234567" className="footer-contact-line">📞 +92 300 1234567</a>
                <span className="footer-contact-line">📍 Islamabad, Pakistan</span>
              </div>
              <div className="footer-socials">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" title="Twitter / X" className="footer-social">𝕏</a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" title="LinkedIn" className="footer-social">in</a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" title="GitHub" className="footer-social">⌘</a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" title="Instagram" className="footer-social">◎</a>
              </div>
            </div>

            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><Link to="/about">About Us</Link></li>
                <li><Link to="/blog">Blog</Link></li>
                <li><Link to="/contact">Contact</Link></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Careers</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Support</h4>
              <ul>
                <li><Link to="/faq">FAQ</Link></li>
                <li><Link to="/contact">Help Center</Link></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>API Docs</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Status</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2026 EventSphere Management. All rights reserved.</span>
            <span className="footer-legal">
              <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              <span className="footer-dot">·</span>
              <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
              <span className="footer-dot">·</span>
              <a href="#" onClick={(e) => e.preventDefault()}>Cookies</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
