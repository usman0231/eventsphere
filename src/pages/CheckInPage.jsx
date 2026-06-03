import React, { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import api from '../utils/api';

export default function CheckInPage() {
  const [scanning, setScanning] = useState(true);
  const [lastResult, setLastResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const lastPayloadRef = useRef('');
  const cooldownRef = useRef(false);

  useEffect(() => () => { cooldownRef.current = false; }, []);

  const handleScan = async (detected) => {
    if (cooldownRef.current) return;
    if (!detected || detected.length === 0) return;
    const raw = detected[0]?.rawValue;
    if (!raw) return;
    if (raw === lastPayloadRef.current) return;
    lastPayloadRef.current = raw;
    cooldownRef.current = true;
    setError('');

    try {
      const { data } = await api.post('/api/checkin', { ticketData: raw });
      setLastResult(data);
      setRecent(prev => [data, ...prev].slice(0, 8));
      if (data.alreadyCheckedIn) {
        toast.info(data.message);
      } else {
        toast.success(data.message);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to validate ticket';
      setError(msg);
      setLastResult({ valid: false, message: msg });
      toast.error(msg);
    } finally {
      setTimeout(() => {
        cooldownRef.current = false;
        lastPayloadRef.current = '';
      }, 2500);
    }
  };

  const handleError = (err) => {
    console.error('Scanner error:', err);
  };

  return (
    <div className="ci-page">
      <div className="ci-orb ci-orb-1" />
      <div className="ci-orb ci-orb-2" />
      <div className="ci-container">
        <div className="ci-header">
          <p className="ci-tag">Entry Validation</p>
          <h1 className="ci-title">🎟️ QR Check-In</h1>
          <p className="ci-subtitle">Point the camera at an attendee's QR ticket to validate entry and record attendance</p>
        </div>

        <div className="ci-layout">
          {/* Scanner */}
          <div className="ci-scanner-wrap">
            <div className="ci-scanner-frame">
              {scanning ? (
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{ facingMode: 'environment' }}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { width: '100%', height: '100%', objectFit: 'cover' },
                  }}
                  components={{ finder: false }}
                />
              ) : (
                <div className="ci-paused">
                  <span>📷</span>
                  <p>Scanner paused</p>
                </div>
              )}
              <div className="ci-overlay">
                <div className="ci-overlay-corner ci-tl" />
                <div className="ci-overlay-corner ci-tr" />
                <div className="ci-overlay-corner ci-bl" />
                <div className="ci-overlay-corner ci-br" />
                <div className="ci-scanline" />
              </div>
            </div>
            <div className="ci-scanner-actions">
              <button className="ci-action-btn" onClick={() => setScanning(s => !s)}>
                {scanning ? '⏸️ Pause Scanner' : '▶️ Resume Scanner'}
              </button>
              <button className="ci-action-btn ci-action-clear" onClick={() => { setLastResult(null); setError(''); }}>
                🔄 Clear Result
              </button>
            </div>
            <p className="ci-hint">
              📱 Allow camera access when prompted. The scanner reads QR tickets generated from the Expo Detail page.
            </p>
          </div>

          {/* Result card */}
          <div className="ci-result-wrap">
            <h3 className="ci-result-title">Last Scan</h3>
            {!lastResult && !error && (
              <div className="ci-result-placeholder">
                <span>📷</span>
                <p>Waiting for a QR scan…</p>
              </div>
            )}
            {lastResult && lastResult.valid && (
              <div className={`ci-result-card ${lastResult.alreadyCheckedIn ? 'ci-result-warn' : 'ci-result-ok'}`}>
                <div className="ci-result-badge">
                  {lastResult.alreadyCheckedIn ? '⚠️ Already Checked In' : '✅ Checked In'}
                </div>
                <div className="ci-attendee">
                  <div className="ci-attendee-avatar">
                    {lastResult.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="ci-attendee-name">{lastResult.user?.name}</div>
                    <div className="ci-attendee-meta">{lastResult.user?.email}</div>
                    {lastResult.user?.company && <div className="ci-attendee-meta">🏢 {lastResult.user.company}</div>}
                    <div className="ci-attendee-role">{lastResult.user?.role}</div>
                  </div>
                </div>
                <div className="ci-result-expo">
                  📅 {lastResult.expo?.title}
                </div>
                <div className="ci-result-time">
                  Checked in at {dayjs(lastResult.checkedInAt).format('MMM D, h:mm:ss A')}
                </div>
              </div>
            )}
            {(error || (lastResult && !lastResult.valid)) && (
              <div className="ci-result-card ci-result-err">
                <div className="ci-result-badge">❌ Invalid Ticket</div>
                <p className="ci-result-msg">{error || lastResult?.message}</p>
              </div>
            )}

            {/* Recent scans */}
            {recent.length > 0 && (
              <>
                <h3 className="ci-result-title ci-recent-title">Recent ({recent.length})</h3>
                <div className="ci-recent-list">
                  {recent.map((r, i) => (
                    <div key={i} className={`ci-recent-row ${r.alreadyCheckedIn ? 'ci-recent-warn' : 'ci-recent-ok'}`}>
                      <div className="ci-recent-avatar">{r.user?.name?.[0]?.toUpperCase() || '?'}</div>
                      <div className="ci-recent-info">
                        <div className="ci-recent-name">{r.user?.name}</div>
                        <div className="ci-recent-meta">{dayjs(r.checkedInAt).format('h:mm:ss A')}</div>
                      </div>
                      <div className="ci-recent-status">{r.alreadyCheckedIn ? 'dup' : '✓'}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
