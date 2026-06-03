import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Default Leaflet marker icons fail to load via webpack; patch the URLs once.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function VenueMap({ lat, lng, venue, address, height = 280 }) {
  // Invalidate size after mount in case the map is rendered inside a hidden container.
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    return () => clearTimeout(t);
  }, []);

  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return (
    <div style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>
            <strong>{venue || 'Venue'}</strong>
            {address && <><br />{address}</>}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
