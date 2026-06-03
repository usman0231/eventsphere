import React, { useState } from 'react';
import { toast } from 'react-toastify';

const INFO = [
  { icon: '📧', label: 'Email Us', value: 'hello@eventsphere.app', href: 'mailto:hello@eventsphere.app' },
  { icon: '📞', label: 'Call Us', value: '+92 300 1234567', href: 'tel:+923001234567' },
  { icon: '📍', label: 'Office', value: 'Plot 42, I-9 Markaz, Islamabad, Pakistan' },
  { icon: '🕒', label: 'Hours', value: 'Mon–Fri, 9:00 AM – 6:00 PM PKT' },
];

const SUBJECTS = ['General Inquiry', 'Sales', 'Technical Support', 'Partnership', 'Press'];

const SOCIALS = [
  { label: 'Twitter / X', icon: '𝕏', href: 'https://twitter.com' },
  { label: 'LinkedIn', icon: 'in', href: 'https://linkedin.com' },
  { label: 'GitHub', icon: '⌘', href: 'https://github.com' },
  { label: 'Instagram', icon: '◎', href: 'https://instagram.com' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General Inquiry', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Thanks! We'll get back to you within 24 hours.");
      setForm({ name: '', email: '', subject: 'General Inquiry', message: '' });
      setSubmitting(false);
    }, 700);
  };

  return (
    <div className="pub-page">
      <div className="pub-orb pub-orb-1" />
      <div className="pub-orb pub-orb-2" />

      <div className="pub-container">
        <div className="pub-hero">
          <div className="pub-tag">Contact Us</div>
          <h1 className="pub-title">Let's <span className="pub-gradient">build something</span> together</h1>
          <div className="pub-divider" />
          <p className="pub-sub">Have a question, a project, or just want to say hello? Drop us a message — we read everything.</p>
        </div>

        <div className="contact-layout">
          <div className="pub-card contact-form-card">
            <h3 className="contact-form-title">Send us a message</h3>
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="contact-form-row">
                <div className="contact-form-group">
                  <label>Your Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="contact-form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div className="contact-form-group">
                <label>Subject</label>
                <select value={form.subject} onChange={(e) => update('subject', e.target.value)}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="contact-form-group">
                <label>Message *</label>
                <textarea
                  rows={6}
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  placeholder="Tell us about your event or question..."
                />
              </div>

              <button type="submit" className="pub-btn-primary contact-submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Message →'}
              </button>
            </form>
          </div>

          <div className="contact-info-side">
            {INFO.map(i => (
              <div key={i.label} className="pub-card contact-info-card">
                <div className="contact-info-icon">{i.icon}</div>
                <div>
                  <div className="contact-info-label">{i.label}</div>
                  {i.href
                    ? <a className="contact-info-value" href={i.href}>{i.value}</a>
                    : <div className="contact-info-value">{i.value}</div>}
                </div>
              </div>
            ))}

            <div className="pub-card contact-socials">
              <div className="contact-socials-label">Follow us</div>
              <div className="contact-socials-row">
                {SOCIALS.map(s => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-social-btn"
                    title={s.label}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pub-section contact-map">
          <h2 className="pub-section-title">Find us</h2>
          <p className="pub-section-sub">Our office is in the heart of Islamabad</p>
          <div className="contact-map-frame">
            <iframe
              title="EventSphere Office Map"
              src="https://maps.google.com/maps?q=Islamabad,%20Pakistan&t=&z=13&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0, borderRadius: 20 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
