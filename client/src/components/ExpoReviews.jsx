import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './ExpoReviews.css';

function Stars({ value, onChange, size = 'md', readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={`stars stars-${size} ${readonly ? 'stars-readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= (hover || value) ? 'star-on' : ''}`}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(n)}
          role={readonly ? undefined : 'button'}
          tabIndex={readonly ? -1 : 0}
        >★</span>
      ))}
    </div>
  );
}

export default function ExpoReviews({ expoId }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avg: 0, count: 0, five: 0, four: 0, three: 0, two: 0, one: 0 });
  const [myReview, setMyReview] = useState(null);
  const [form, setForm] = useState({ rating: 0, title: '', comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: pub }, mineRes] = await Promise.all([
        api.get(`/api/reviews/expo/${expoId}`),
        user ? api.get(`/api/reviews/expo/${expoId}/me`) : Promise.resolve({ data: { data: null } }),
      ]);
      setReviews(pub.data || []);
      setSummary(pub.summary || { avg: 0, count: 0 });
      if (mineRes.data?.data) {
        setMyReview(mineRes.data.data);
        setForm({ rating: mineRes.data.data.rating, title: mineRes.data.data.title || '', comment: mineRes.data.data.comment || '' });
      }
    } catch (err) { /* ignore */ }
  }, [expoId, user]);

  useEffect(() => { if (expoId) load(); }, [expoId, load]);

  const submit = async () => {
    if (!form.rating) {
      toast.error('Please pick a star rating');
      return;
    }
    try {
      setSubmitting(true);
      const { data } = await api.post('/api/reviews', { expoId, ...form });
      toast.success(myReview ? 'Review updated' : 'Review submitted');
      setMyReview(data.data);
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await api.delete(`/api/reviews/expo/${expoId}`);
      toast.success('Review deleted');
      setMyReview(null);
      setForm({ rating: 0, title: '', comment: '' });
      load();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const total = summary.count || 1;
  const dist = [
    ['5', summary.five], ['4', summary.four], ['3', summary.three], ['2', summary.two], ['1', summary.one],
  ];

  return (
    <div className="rv-wrap">
      <div className="rv-summary">
        <div className="rv-summary-score">
          <div className="rv-avg">{summary.count > 0 ? Number(summary.avg).toFixed(1) : '—'}</div>
          <Stars value={Math.round(summary.avg || 0)} readonly />
          <div className="rv-count">{summary.count} review{summary.count !== 1 ? 's' : ''}</div>
        </div>
        <div className="rv-summary-dist">
          {dist.map(([star, n]) => (
            <div key={star} className="rv-dist-row">
              <span className="rv-dist-star">{star}★</span>
              <div className="rv-dist-bar">
                <div className="rv-dist-fill" style={{ width: `${(n / total) * 100}%` }} />
              </div>
              <span className="rv-dist-num">{n || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* My review form */}
      {user ? (
        myReview && !editing ? (
          <div className="rv-mine">
            <div className="rv-mine-head">
              <span className="rv-mine-label">Your review</span>
              <div className="rv-mine-actions">
                <button className="rv-link" onClick={() => setEditing(true)}>✏️ Edit</button>
                <button className="rv-link rv-link-red" onClick={remove}>🗑 Delete</button>
              </div>
            </div>
            <Stars value={myReview.rating} readonly />
            {myReview.title && <h4 className="rv-title">{myReview.title}</h4>}
            {myReview.comment && <p className="rv-comment">{myReview.comment}</p>}
            <p className="rv-date">{dayjs(myReview.updatedAt || myReview.createdAt).format('MMM D, YYYY')}</p>
          </div>
        ) : (
          <div className="rv-form">
            <h4 className="rv-form-title">{myReview ? 'Edit your review' : 'Leave a review'}</h4>
            <div className="rv-field">
              <label className="rv-label">Your rating</label>
              <Stars value={form.rating} onChange={r => setForm({ ...form, rating: r })} size="lg" />
            </div>
            <div className="rv-field">
              <input
                className="rv-input"
                placeholder="Title (optional)"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value.slice(0, 120) })}
              />
            </div>
            <div className="rv-field">
              <textarea
                className="rv-input rv-textarea"
                rows={3}
                placeholder="Share details — what went well, what could be better…"
                value={form.comment}
                onChange={e => setForm({ ...form, comment: e.target.value.slice(0, 1500) })}
              />
            </div>
            <div className="rv-form-actions">
              {editing && <button className="rv-btn rv-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
              <button className="rv-btn rv-btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : myReview ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="rv-cta">Log in to leave a review</div>
      )}

      {/* Public reviews */}
      <div className="rv-list">
        {reviews.length === 0 ? (
          <div className="rv-empty">No reviews yet — be the first.</div>
        ) : (
          reviews.map(r => (
            <div key={r._id} className="rv-card">
              <div className="rv-card-head">
                <div className="rv-card-avatar">{r.user?.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="rv-card-meta">
                  <div className="rv-card-name">{r.user?.name || 'Anonymous'}</div>
                  <Stars value={r.rating} readonly size="sm" />
                </div>
                <div className="rv-card-date">{dayjs(r.createdAt).format('MMM D, YYYY')}</div>
              </div>
              {r.title && <h4 className="rv-title">{r.title}</h4>}
              {r.comment && <p className="rv-comment">{r.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
