import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import FloorPlan from '../components/FloorPlan';
import Booth3DView from '../components/Booth3DView';

// Distinct color per size — no overlap with the status palette (green/amber/purple).
const sizeColors = { small:'#888', medium:'#00d4ff', large:'#ff6b35', 'extra-large':'#ff006e' };

export default function BoothManagementPage() {
  const { id: expoId } = useParams();
  const navigate = useNavigate();
  const { isOrganizer, user } = useAuth();
  const [booths, setBooths] = useState([]);
  const [expo, setExpo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [reserveDialog, setReserveDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [form, setForm] = useState({ description:'', products:'', status:'available' });
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ count: 5, size: 'medium', price: 0 });
  const [view, setView] = useState('floorplan');
  const [applications, setApplications] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBooths(); fetchExpo(); }, [expoId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOrganizer) fetchApplications(); }, [expoId, isOrganizer]);

  const fetchBooths = async () => {
    try {
      const { data } = await api.get(`/api/booths/expo/${expoId}`);
      setBooths(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchExpo = async () => {
    try {
      const { data } = await api.get(`/api/expos/${expoId}`);
      setExpo(data.data);
    } catch { /* non-fatal */ }
  };

  const fetchApplications = async () => {
    try {
      const { data } = await api.get(`/api/exhibitors/expo/${expoId}`);
      setApplications(data.data || []);
    } catch (err) { /* not authorized as organizer, ignore */ }
  };

  const handleAssignExhibitor = async (booth, exhibitor) => {
    try {
      await api.put(`/api/exhibitors/${exhibitor._id}/status`, {
        status: 'approved',
        boothId: booth._id,
      });
      toast.success(`Assigned ${exhibitor.companyName} to ${booth.boothNumber}`);
      fetchBooths();
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign exhibitor');
    }
  };

  const handleReserve = async () => {
    try {
      await api.post(`/api/booths/${selected._id}/reserve`, { description:form.description, products:form.products.split(',').map(p=>p.trim()).filter(Boolean) });
      toast.success('Booth reserved!');
      setReserveDialog(false);
      setSelected(null);
      fetchBooths();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleAddBooths = async () => {
    try {
      const { data } = await api.post('/api/booths', {
        expo: expoId,
        count: Number(addForm.count),
        size: addForm.size,
        price: Number(addForm.price) || 0,
      });
      toast.success(data.message || `Added ${data.data.length} booths`);
      setAddDialog(false);
      fetchBooths();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add booths');
    }
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/api/booths/${selected._id}`, { status:form.status, description:form.description });
      toast.success('Booth updated!');
      setEditDialog(false);
      setSelected(null);
      fetchBooths();
    } catch (err) { toast.error('Failed to update'); }
  };

  const available = booths.filter(b=>b.status==='available').length;
  const reserved = booths.filter(b=>b.status==='reserved').length;
  const occupied = booths.filter(b=>b.status==='occupied').length;

  return (
    <div className="booth-page">
      <div className="booth-orb booth-orb-1" />
      <div className="booth-orb booth-orb-2" />
      <div className="booth-container">
        <button className="booth-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="booth-header">
          <div>
            <p className="booth-tag">Floor Plan</p>
            <h1 className="booth-title">Booth Management</h1>
            <p className="booth-subtitle">Click any booth to view details or manage it</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isOrganizer && (
              <button className="booth-public-btn" onClick={() => setAddDialog(true)}>➕ Add Booths</button>
            )}
            <button className="booth-public-btn" onClick={() => navigate(`/expos/${expoId}/floor`)}>
              🌐 Public View
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="booth-stats">
          {[['Available', available,'#00ff88'],['Reserved', reserved,'#ffb300'],['Occupied', occupied,'#7b2ff7'],['Total', booths.length,'#00d4ff']].map(([l,v,c]) => (
            <div key={l} className="booth-stat">
              <span className="booth-stat-val" style={{color:c}}>{v}</span>
              <span className="booth-stat-label">{l}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="booth-legend">
          <span className="booth-legend-title">Status:</span>
          {[['Available','#00ff88'],['Reserved','#ffb300'],['Occupied','#7b2ff7']].map(([l,c]) => (
            <span key={l} className="booth-legend-item"><span className="booth-legend-dot" style={{background:c}} />{l}</span>
          ))}
          <span className="booth-legend-title" style={{marginLeft:16}}>Size:</span>
          {Object.entries(sizeColors).map(([s,c]) => (
            <span key={s} className="booth-legend-item"><span className="booth-legend-dot" style={{background:c}} />{s}</span>
          ))}
        </div>

        {/* View toggle */}
        <div className="fp-view-toggle">
          <button className={`fp-view-btn ${view==='floorplan'?'active':''}`} onClick={() => setView('floorplan')}>🗺️ Floor Plan</button>
          <button className={`fp-view-btn ${view==='3d'?'active':''}`} onClick={() => setView('3d')}>🧊 3D</button>
          <button className={`fp-view-btn ${view==='grid'?'active':''}`} onClick={() => setView('grid')}>▦ Grid</button>
        </div>

        {/* Floor Plan / Grid */}
        {loading ? (
          <div className="booth-loading">Loading floor plan...</div>
        ) : view === 'floorplan' ? (
          <FloorPlan
            booths={booths}
            isAdmin={isOrganizer}
            backgroundImage={expo?.floorPlan}
            onSelectBooth={booth => {
              setSelected(booth);
              setForm({ description: booth.description || '', products: booth.products?.join(', ') || '', status: booth.status });
            }}
            onAssignExhibitor={handleAssignExhibitor}
          />
        ) : view === '3d' ? (
          <Booth3DView
            booths={booths}
            onSelectBooth={booth => {
              setSelected(booth);
              setForm({ description: booth.description || '', products: booth.products?.join(', ') || '', status: booth.status });
            }}
          />
        ) : (
          <div className="booth-grid">
            {booths.map(booth => {
              const statusColor = booth.status==='available'?'#00ff88':booth.status==='reserved'?'#ffb300':'#7b2ff7';
              const sizeBg = `${sizeColors[booth.size]}18`;
              return (
                <div key={booth._id} className="booth-cell" style={{ borderColor:`${statusColor}50`, background:`${statusColor}08` }}
                  onClick={() => { setSelected(booth); setForm({ description:booth.description||'', products:booth.products?.join(', ')||'', status:booth.status }); }}>
                  <div className="booth-cell-num">{booth.boothNumber}</div>
                  <div className="booth-cell-size" style={{ color:sizeColors[booth.size], background:sizeBg }}>{booth.size}</div>
                  <div style={{ fontSize:'0.6rem', fontWeight:700, textTransform:'capitalize', color:statusColor, background:`${statusColor}1f`, border:`1px solid ${statusColor}55`, borderRadius:6, padding:'1px 6px', marginTop:4 }}>{booth.status}</div>
                  {booth.exhibitor && <div className="booth-cell-tenant">{booth.exhibitor.name?.[0]?.toUpperCase()}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Drag-and-drop exhibitor pool (admins only, floor plan view) */}
        {isOrganizer && view === 'floorplan' && (
          <div className="fp-exhibitor-pool">
            <div className="fp-pool-title">
              📋 Pending Exhibitor Applications
              <span className="fp-pool-hint">— drag onto a booth to assign</span>
            </div>
            {applications.filter(a => !a.assignedBooth).length === 0 ? (
              <div className="fp-pool-empty">No pending applications — all exhibitors are assigned.</div>
            ) : (
              <div className="fp-pool-list">
                {applications.filter(a => !a.assignedBooth).map(app => (
                  <div
                    key={app._id}
                    className="fp-pool-card"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(
                        'application/x-exhibitor',
                        JSON.stringify({ _id: app._id, companyName: app.companyName })
                      );
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    title={`Drag to assign ${app.companyName} to a booth`}
                  >
                    <div className="fp-pool-avatar">{app.companyName?.[0]?.toUpperCase() || '?'}</div>
                    <div className="fp-pool-name">{app.companyName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && !reserveDialog && !editDialog && (
        <div className="booth-overlay" onClick={() => setSelected(null)}>
          <div className="booth-modal" onClick={e=>e.stopPropagation()}>
            <div className="booth-modal-header">
              <h3>Booth {selected.boothNumber}</h3>
              <button className="booth-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="booth-modal-body">
              <div className="booth-detail-row">
                <span className="booth-detail-key">Status</span>
                <span className="booth-detail-val" style={{ color: selected.status==='available'?'#00ff88':selected.status==='reserved'?'#ffb300':'#b388ff' }}>{selected.status}</span>
              </div>
              <div className="booth-detail-row"><span className="booth-detail-key">Size</span><span className="booth-detail-val">{selected.size}</span></div>
              <div className="booth-detail-row"><span className="booth-detail-key">Price</span><span className="booth-detail-val">${selected.price}</span></div>
              {selected.exhibitor && (
                <div className="booth-detail-row">
                  <span className="booth-detail-key">Exhibitor</span>
                  <span className="booth-detail-val">{selected.exhibitor.name} {selected.exhibitor.company ? `(${selected.exhibitor.company})` : ''}</span>
                </div>
              )}
              {selected.status !== 'available' && expo && (
                <div className="booth-detail-row">
                  <span className="booth-detail-key">Booked for</span>
                  <span className="booth-detail-val">{dayjs(expo.startDate).format('MMM D')} – {dayjs(expo.endDate).format('MMM D, YYYY')}</span>
                </div>
              )}
              {selected.status !== 'available' && selected.updatedAt && (
                <div className="booth-detail-row">
                  <span className="booth-detail-key">Reserved on</span>
                  <span className="booth-detail-val">{dayjs(selected.updatedAt).format('MMM D, YYYY')}</span>
                </div>
              )}
              {selected.staffCount > 0 && (
                <div className="booth-detail-row"><span className="booth-detail-key">Staff</span><span className="booth-detail-val">{selected.staffCount}</span></div>
              )}
              {selected.amenities?.length > 0 && (
                <div className="booth-detail-row"><span className="booth-detail-key">Amenities</span><span className="booth-detail-val">{selected.amenities.join(', ')}</span></div>
              )}
              {selected.description && <p className="booth-detail-desc">{selected.description}</p>}
              {selected.products?.length > 0 && (
                <div className="booth-detail-products">
                  {selected.products.map(p => <span key={p} className="booth-product-tag">{p}</span>)}
                </div>
              )}
            </div>
            <div className="booth-modal-footer">
              {selected.status === 'available' && user?.role === 'exhibitor' && (
                <button className="booth-action-btn booth-action-green" onClick={() => setReserveDialog(true)}>Reserve Booth</button>
              )}
              {isOrganizer && (
                <button className="booth-action-btn booth-action-purple" onClick={() => setEditDialog(true)}>Edit Booth</button>
              )}
              <button className="booth-action-btn booth-action-gray" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reserve Dialog */}
      {reserveDialog && (
        <div className="booth-overlay" onClick={() => setReserveDialog(false)}>
          <div className="booth-modal" onClick={e=>e.stopPropagation()}>
            <div className="booth-modal-header">
              <h3>Reserve Booth {selected?.boothNumber}</h3>
              <button className="booth-modal-close" onClick={() => setReserveDialog(false)}>✕</button>
            </div>
            <div className="booth-modal-body">
              <div className="booth-form-group">
                <label className="booth-label">Description</label>
                <textarea className="booth-input booth-textarea" rows={3} placeholder="What will you showcase?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="booth-form-group">
                <label className="booth-label">Products (comma-separated)</label>
                <input className="booth-input" placeholder="Product A, Service B" value={form.products} onChange={e => setForm({...form, products: e.target.value})} />
              </div>
            </div>
            <div className="booth-modal-footer">
              <button className="booth-action-btn booth-action-gray" onClick={() => setReserveDialog(false)}>Cancel</button>
              <button className="booth-action-btn booth-action-green" onClick={handleReserve}>Confirm Reserve</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editDialog && (
        <div className="booth-overlay" onClick={() => setEditDialog(false)}>
          <div className="booth-modal" onClick={e=>e.stopPropagation()}>
            <div className="booth-modal-header">
              <h3>Edit Booth {selected?.boothNumber}</h3>
              <button className="booth-modal-close" onClick={() => setEditDialog(false)}>✕</button>
            </div>
            <div className="booth-modal-body">
              <div className="booth-form-group">
                <label className="booth-label">Status</label>
                <select className="booth-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {['available','reserved','occupied'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="booth-form-group">
                <label className="booth-label">Notes</label>
                <textarea className="booth-input booth-textarea" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
            </div>
            <div className="booth-modal-footer">
              <button className="booth-action-btn booth-action-gray" onClick={() => setEditDialog(false)}>Cancel</button>
              <button className="booth-action-btn booth-action-purple" onClick={handleUpdate}>Update Booth</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Booths Dialog */}
      {addDialog && (
        <div className="booth-overlay" onClick={() => setAddDialog(false)}>
          <div className="booth-modal" onClick={e=>e.stopPropagation()}>
            <div className="booth-modal-header">
              <h3>Add Booths</h3>
              <button className="booth-modal-close" onClick={() => setAddDialog(false)}>✕</button>
            </div>
            <div className="booth-modal-body">
              <div className="booth-form-group">
                <label className="booth-label">How many?</label>
                <input className="booth-input" type="number" min={1} max={100} value={addForm.count} onChange={e => setAddForm({ ...addForm, count: e.target.value })} />
              </div>
              <div className="booth-form-group">
                <label className="booth-label">Size</label>
                <select className="booth-input" value={addForm.size} onChange={e => setAddForm({ ...addForm, size: e.target.value })}>
                  {['small','medium','large','extra-large'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="booth-form-group">
                <label className="booth-label">Price ($)</label>
                <input className="booth-input" type="number" min={0} value={addForm.price} onChange={e => setAddForm({ ...addForm, price: e.target.value })} />
              </div>
              <p style={{ fontSize:'0.82rem', opacity:0.6, margin:'4px 0 0' }}>New booths continue the numbering (e.g. after B018 → B019…) and start as <strong>available</strong>.</p>
            </div>
            <div className="booth-modal-footer">
              <button className="booth-action-btn booth-action-gray" onClick={() => setAddDialog(false)}>Cancel</button>
              <button className="booth-action-btn booth-action-green" onClick={handleAddBooths}>Add Booths</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}