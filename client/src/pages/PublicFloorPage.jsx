import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import FloorPlan from '../components/FloorPlan';
import './PublicFloorPage.css';

export default function PublicFloorPage() {
  const { id: expoId } = useParams();
  const navigate = useNavigate();
  const [expo, setExpo] = useState(null);
  const [booths, setBooths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [expoRes, boothRes] = await Promise.all([
          api.get(`/api/expos/${expoId}`),
          api.get(`/api/booths/expo/${expoId}`),
        ]);
        if (!mounted) return;
        setExpo(expoRes.data.data);
        setBooths(boothRes.data.data || []);
      } catch (e) {
        if (mounted) setErr('Failed to load floor plan.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [expoId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };

  if (loading) return <div className="pf-page"><div className="pf-loading">Loading floor plan...</div></div>;
  if (err || !expo) return <div className="pf-page"><div className="pf-loading">{err || 'Expo not found'}</div></div>;

  const available = booths.filter(b => b.status === 'available').length;
  const reserved = booths.filter(b => b.status === 'reserved').length;
  const occupied = booths.filter(b => b.status === 'occupied').length;

  return (
    <div className="pf-page">
      <div className="pf-orb pf-orb-1" />
      <div className="pf-orb pf-orb-2" />

      <div className="pf-container">
        <div className="pf-header">
          <div>
            <div className="pf-tag">Public Floor Plan</div>
            <h1 className="pf-title">{expo.title}</h1>
            <div className="pf-meta">
              {expo.location?.venue && <span>📍 {expo.location.venue}{expo.location.city ? `, ${expo.location.city}` : ''}</span>}
              {expo.startDate && <span>📅 {new Date(expo.startDate).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="pf-actions">
            <button className="pf-btn-outline" onClick={copyLink}>🔗 Copy Link</button>
            <button className="pf-btn-primary" onClick={() => navigate(`/expos/${expoId}`)}>View Expo →</button>
          </div>
        </div>

        <div className="pf-stats">
          {[
            ['Available', available, '#00ff88'],
            ['Reserved', reserved, '#ffb300'],
            ['Occupied', occupied, '#b388ff'],
            ['Total', booths.length, '#00d4ff'],
          ].map(([l, v, c]) => (
            <div key={l} className="pf-stat">
              <div className="pf-stat-val" style={{ color: c }}>{v}</div>
              <div className="pf-stat-label">{l}</div>
            </div>
          ))}
        </div>

        <div className="pf-legend">
          <span className="pf-legend-title">Legend:</span>
          <span className="pf-legend-item"><span className="pf-dot" style={{ background: '#00ff88' }} />Available</span>
          <span className="pf-legend-item"><span className="pf-dot" style={{ background: '#ffb300' }} />Reserved</span>
          <span className="pf-legend-item"><span className="pf-dot" style={{ background: '#b388ff' }} />Occupied</span>
        </div>

        <FloorPlan
          booths={booths}
          readOnly
          backgroundImage={expo.floorPlan}
          onSelectBooth={(b) => setSelected(b)}
        />

        {selected && (
          <div className="pf-overlay" onClick={() => setSelected(null)}>
            <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pf-modal-header">
                <h3>Booth {selected.boothNumber}</h3>
                <button className="pf-modal-close" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="pf-modal-body">
                <div className="pf-row">
                  <span className="pf-row-key">Status</span>
                  <span className="pf-row-val" style={{ color: selected.status === 'available' ? '#00ff88' : selected.status === 'reserved' ? '#ffb300' : '#b388ff' }}>{selected.status}</span>
                </div>
                <div className="pf-row"><span className="pf-row-key">Size</span><span className="pf-row-val">{selected.size}</span></div>
                {selected.price ? <div className="pf-row"><span className="pf-row-key">Price</span><span className="pf-row-val">${selected.price}</span></div> : null}
                {selected.exhibitor && (
                  <div className="pf-row">
                    <span className="pf-row-key">Exhibitor</span>
                    <span className="pf-row-val">{selected.exhibitor.name}{selected.exhibitor.company ? ` (${selected.exhibitor.company})` : ''}</span>
                  </div>
                )}
                {selected.description && <p className="pf-desc">{selected.description}</p>}
                {selected.products?.length > 0 && (
                  <div className="pf-products">
                    {selected.products.map(p => <span key={p} className="pf-product-tag">{p}</span>)}
                  </div>
                )}
              </div>
              <div className="pf-modal-footer">
                {selected.status === 'available' && (
                  <button className="pf-btn-primary" onClick={() => navigate('/register')}>Apply for this Booth</button>
                )}
                <button className="pf-btn-outline" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
