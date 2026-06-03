import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

const TYPES = [
  { value:'suggestion', icon:'💡', label:'Suggestion', desc:'Share your ideas' },
  { value:'bug', icon:'🐛', label:'Bug Report', desc:'Found something broken?' },
  { value:'complaint', icon:'😤', label:'Complaint', desc:'Tell us what went wrong' },
  { value:'compliment', icon:'⭐', label:'Compliment', desc:'Share the love!' },
];

export default function FeedbackPage() {
  const [form, setForm] = useState({ type:'suggestion', subject:'', message:'', rating:5 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/api/feedback', form);
      toast.success('Feedback submitted! Thank you 🙏');
      setSuccess(true);
      setForm({ type:'suggestion', subject:'', message:'', rating:5 });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback');
    } finally { setLoading(false); }
  };

  return (
    <div className="fb-page">
      <div className="fb-orb fb-orb-1" />
      <div className="fb-orb fb-orb-2" />
      <div className="fb-container">
        <div className="fb-header">
          <p className="fb-tag">Help Us Improve</p>
          <h1 className="fb-title">Feedback & Support</h1>
          <p className="fb-subtitle">Your thoughts help us make EventSphere better for everyone</p>
        </div>
        <div className="fb-layout">
          <div className="fb-form-side">
            <div className="fb-card">
              {success && (
                <div className="fb-success">
                  <span>🎉</span>
                  <p>Thank you for your feedback! We'll review it shortly.</p>
                </div>
              )}
              {error && <div className="fb-error">{error}</div>}

              {/* Type Selector */}
              <div className="fb-type-grid">
                {TYPES.map(t => (
                  <div key={t.value} className={`fb-type-card ${form.type === t.value ? 'active' : ''}`} onClick={() => setForm({...form, type: t.value})}>
                    <span className="fb-type-icon">{t.icon}</span>
                    <span className="fb-type-label">{t.label}</span>
                    <span className="fb-type-desc">{t.desc}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="fb-form">
                {/* Star Rating */}
                <div className="fb-form-group">
                  <label className="fb-label">Overall Rating</label>
                  <div className="fb-stars">
                    {[1,2,3,4,5].map(star => (
                      <button key={star} type="button" className={`fb-star ${form.rating >= star ? 'active' : ''}`} onClick={() => setForm({...form, rating: star})}>★</button>
                    ))}
                    <span className="fb-star-label">{form.rating}/5</span>
                  </div>
                </div>
                <div className="fb-form-group">
                  <label className="fb-label">Subject</label>
                  <input className="fb-input" type="text" placeholder="Brief subject of your feedback" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required />
                </div>
                <div className="fb-form-group">
                  <label className="fb-label">Your Message</label>
                  <textarea className="fb-input fb-textarea" rows={6} placeholder="Describe your feedback in detail..." value={form.message} onChange={e => setForm({...form, message: e.target.value})} required />
                </div>
                <button className="fb-submit-btn" type="submit" disabled={loading}>
                  {loading ? <span className="fb-spinner" /> : '🚀 Submit Feedback'}
                </button>
              </form>
            </div>
          </div>

          <div className="fb-info-side">
            {[
              { icon:'💡', title:'Suggestions', desc:'Have an idea to improve EventSphere? We love hearing from our community and regularly implement user suggestions.' },
              { icon:'🐛', title:'Bug Reports', desc:'Found something broken? Let us know with as much detail as possible so we can fix it quickly.' },
              { icon:'💬', title:'General Support', desc:'Have questions or need help navigating the platform? Our support team is here for you.' },
              { icon:'⭐', title:'Compliments', desc:'Love something about EventSphere? We\'d love to hear what\'s working great for you!' },
            ].map(item => (
              <div key={item.title} className="fb-info-card">
                <span className="fb-info-icon">{item.icon}</span>
                <div>
                  <h4 className="fb-info-title">{item.title}</h4>
                  <p className="fb-info-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}