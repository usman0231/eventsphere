import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRTicket({ user, expo, onClose }) {
  const ticketRef = useRef(null);
  const qrWrapRef = useRef(null);

  const ticketData = JSON.stringify({
    userId: user?._id,
    expoId: expo?._id,
    name: user?.name,
    expo: expo?.title,
    timestamp: Date.now()
  });

  const safeFilename = (s) =>
    (s || 'eventsphere-ticket')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  const downloadQR = () => {
    const svg = qrWrapRef.current?.querySelector('svg');
    if (!svg) return;

    const PIXEL_SIZE = 800;
    const PADDING = 40;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PIXEL_SIZE + PADDING * 2;
      canvas.height = PIXEL_SIZE + PADDING * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, PADDING, PADDING, PIXEL_SIZE, PIXEL_SIZE);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeFilename(expo?.title)}-${safeFilename(user?.name)}-qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = svg64;
  };

  const handlePrint = () => {
    const content = ticketRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>EventSphere Ticket</title>
      <style>
        body { margin:0; background:#0a0a1a; display:flex; justify-content:center; padding:40px; font-family:sans-serif; }
        .ticket { background:linear-gradient(135deg,#1a0a2e,#0d1b3e); border:1px solid rgba(123,47,247,0.4); border-radius:20px; padding:32px; color:white; max-width:400px; }
        .t-logo { font-size:1.5rem; font-weight:900; background:linear-gradient(135deg,#6c3de8,#e83d8a); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:20px; }
        .t-event { font-size:1.3rem; font-weight:700; margin-bottom:8px; }
        .t-name { font-size:0.95rem; opacity:0.7; margin-bottom:20px; }
        .t-qr { background:white; padding:16px; border-radius:12px; display:inline-block; margin-bottom:16px; }
        .t-id { font-size:0.75rem; opacity:0.4; font-family:monospace; }
        .t-valid { font-size:0.8rem; opacity:0.5; margin-top:8px; }
      </style></head><body>
      <div class="ticket">
        ${content.innerHTML}
      </div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>🎫 Your Event Ticket</h3>
          <button className="qr-close" onClick={onClose}>✕</button>
        </div>
        <div className="qr-ticket" ref={ticketRef}>
          <div className="qr-ticket-logo">EventSphere</div>
          <div className="qr-ticket-event">{expo?.title || 'EventSphere Expo'}</div>
          <div className="qr-ticket-name">👤 {user?.name}</div>
          {expo?.location?.venue && (
            <div className="qr-ticket-venue">📍 {expo.location.venue}, {expo.location.city}</div>
          )}
          <div className="qr-code-wrap" ref={qrWrapRef}>
            <QRCodeSVG
              value={ticketData}
              size={200}
              bgColor="#ffffff"
              fgColor="#0a0a1a"
              level="H"
              includeMargin
            />
          </div>
          <div className="qr-ticket-id">
            ID: {user?._id?.slice(-8)?.toUpperCase()}
          </div>
          <div className="qr-ticket-valid">
            ✅ Valid for entry — Show this at the venue
          </div>
        </div>
        <div className="qr-actions">
          <button className="qr-download-btn" onClick={downloadQR}>⬇️ Download QR</button>
          <button className="qr-print-btn" onClick={handlePrint}>🖨️ Print</button>
          <button className="qr-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
