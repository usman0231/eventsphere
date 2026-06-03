import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['All', 'Product Updates', 'Event Trends', 'Success Stories', 'Guides'];

const POSTS = [
  {
    id: 1,
    category: 'Product Updates',
    title: 'EventSphere is now a PWA — install it like a native app',
    excerpt: "We've shipped a Progressive Web App build so organizers can install EventSphere on iOS, Android, and desktop. Faster startup, offline ticket viewing, and the same experience across devices.",
    author: 'Jahanzeb Hussain',
    date: 'May 18, 2026',
    readTime: '4 min',
    cover: 'linear-gradient(135deg, #6c3de8, #e83d8a)',
    badge: '🚀',
  },
  {
    id: 2,
    category: 'Event Trends',
    title: '5 reasons hybrid expos are outperforming pure in-person events',
    excerpt: "Hybrid formats — physical venue plus livestreamed sessions — are seeing 3x the registration numbers of in-person-only events. Here's what's driving the shift.",
    author: 'Aisha Malik',
    date: 'May 12, 2026',
    readTime: '6 min',
    cover: 'linear-gradient(135deg, #00d4ff, #6c3de8)',
    badge: '📈',
  },
  {
    id: 3,
    category: 'Success Stories',
    title: 'How TechExpo Karachi 2026 ran 1,800 attendees with EventSphere',
    excerpt: "From booth allocation chaos to a smooth two-day event — TechExpo's organizers share how they replaced four separate tools with EventSphere.",
    author: 'Sara Nadeem',
    date: 'May 5, 2026',
    readTime: '8 min',
    cover: 'linear-gradient(135deg, #ff6b35, #e83d8a)',
    badge: '⭐',
  },
  {
    id: 4,
    category: 'Guides',
    title: 'Setting up your first expo in under 10 minutes',
    excerpt: 'A step-by-step walkthrough: create the event, upload your floor plan, configure booth categories, and publish — all without writing a line of code.',
    author: 'Rahul Khan',
    date: 'April 28, 2026',
    readTime: '5 min',
    cover: 'linear-gradient(135deg, #00ff88, #00d4ff)',
    badge: '📘',
  },
  {
    id: 5,
    category: 'Product Updates',
    title: 'New: QR code download for attendee tickets',
    excerpt: "Attendees can now download their entry QR code as a PNG image — no more 'lost my email' moments. Print it, save it, screenshot it, it works.",
    author: 'Jahanzeb Hussain',
    date: 'April 22, 2026',
    readTime: '3 min',
    cover: 'linear-gradient(135deg, #b388ff, #00d4ff)',
    badge: '🎟️',
  },
  {
    id: 6,
    category: 'Event Trends',
    title: 'The case for asynchronous expo content',
    excerpt: 'Why successful organizers are recording sessions and offering them as on-demand content for 30 days post-event — and seeing 40% engagement lifts.',
    author: 'Aisha Malik',
    date: 'April 15, 2026',
    readTime: '5 min',
    cover: 'linear-gradient(135deg, #e83d8a, #ff6b35)',
    badge: '🎥',
  },
  {
    id: 7,
    category: 'Guides',
    title: 'Booth allocation playbook for first-time organizers',
    excerpt: 'How to price booths by category, handle waitlists, and avoid the most common pitfalls when you have more exhibitor demand than space.',
    author: 'Rahul Khan',
    date: 'April 8, 2026',
    readTime: '7 min',
    cover: 'linear-gradient(135deg, #6c3de8, #00d4ff)',
    badge: '🏢',
  },
  {
    id: 8,
    category: 'Success Stories',
    title: 'A 200-booth medical expo, run by a 4-person team',
    excerpt: 'MedCon 2026 used EventSphere to coordinate 200 booths, 60 sessions, and 5,000+ attendees with a team of four. Here is how they did it.',
    author: 'Sara Nadeem',
    date: 'April 1, 2026',
    readTime: '6 min',
    cover: 'linear-gradient(135deg, #00d4ff, #00ff88)',
    badge: '🩺',
  },
];

export default function BlogPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('All');
  const [email, setEmail] = useState('');

  const filtered = category === 'All' ? POSTS : POSTS.filter(p => p.category === category);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmail('');
    alert(`Subscribed! We'll send updates to ${email}.`);
  };

  return (
    <div className="pub-page">
      <div className="pub-orb pub-orb-1" />
      <div className="pub-orb pub-orb-2" />

      <div className="pub-container">
        <div className="pub-hero">
          <div className="pub-tag">Blog & News</div>
          <h1 className="pub-title">Insights from the <span className="pub-gradient">expo world</span></h1>
          <div className="pub-divider" />
          <p className="pub-sub">Product updates, event trends, success stories, and how-to guides from the EventSphere team.</p>
        </div>

        <div className="blog-filters">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`blog-filter ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="blog-grid">
          {filtered.map(post => (
            <article key={post.id} className="blog-card" onClick={() => navigate(`/blog/${post.id}`)}>
              <div className="blog-cover" style={{ background: post.cover }}>
                <span className="blog-cover-icon">{post.badge}</span>
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span className="blog-category">{post.category}</span>
                  <span>·</span>
                  <span>{post.readTime} read</span>
                </div>
                <h3 className="blog-title">{post.title}</h3>
                <p className="blog-excerpt">{post.excerpt}</p>
                <div className="blog-footer">
                  <span className="blog-author">{post.author}</span>
                  <span className="blog-date">{post.date}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="blog-empty">No posts in this category yet — check back soon.</div>
        )}

        <div className="blog-newsletter">
          <h2 className="blog-newsletter-title">Get the EventSphere newsletter</h2>
          <p className="blog-newsletter-sub">Once a month. Product updates, organizer tips, and event-industry insights.</p>
          <form onSubmit={handleSubscribe} className="blog-newsletter-form">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="blog-newsletter-input"
            />
            <button type="submit" className="pub-btn-primary">Subscribe</button>
          </form>
        </div>
      </div>
    </div>
  );
}
