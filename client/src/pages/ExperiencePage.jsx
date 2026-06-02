import React, { useMemo, useState, useRef, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, Float, Html } from '@react-three/drei';
import * as THREE from 'three';

import HallStructure from '../components/experience/HallStructure';
import InstancedAttendees from '../components/experience/InstancedAttendees';
import HoloPanel from '../components/experience/HoloPanel';
import CameraRig from '../components/experience/CameraRig';
import ExperienceHUD from '../components/experience/ExperienceHUD';
import PostFX from '../components/experience/PostFX';
import WebGLBoundary from '../components/WebGLBoundary';
import { audio } from '../utils/audio';
import api from '../utils/api';
import '../components/experience/ExperiencePage.css';

/* ─────────────────────────────────────────────────────────────
   Static world data
   ───────────────────────────────────────────────────────────── */

// Two halls, side by side. Aisle in the middle.
const HALL_HALF_W = 9;     // each hall is 18 wide
const HALL_DEPTH = 22;
const HALL_HEIGHT = 7;
const HALL_GAP = 6;        // space between the two halls

const HALL_A_X = -(HALL_HALF_W + HALL_GAP / 2);
const HALL_B_X = +(HALL_HALF_W + HALL_GAP / 2);

// Booth grid inside each hall
function buildBoothLayout() {
  const booths = [];
  const COLS = 3;
  const ROWS = 4;
  const xStep = 4.5;
  const zStep = 4.5;
  const palette = ['#7b2ff7', '#00d4ff', '#ff006e', '#ff6b35', '#a855f7', '#22d3ee'];

  for (let h = 0; h < 2; h++) {
    const hallX = h === 0 ? HALL_A_X : HALL_B_X;
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const x = hallX + (i - (COLS - 1) / 2) * xStep;
        const z = (j - (ROWS - 1) / 2) * zStep;
        const id = booths.length;
        booths.push({
          id,
          hall: h === 0 ? 'A' : 'B',
          position: [x, 0, z],
          height: 1.2 + (id % 4) * 0.25,
          color: palette[id % palette.length],
          label: `Booth ${h === 0 ? 'A' : 'B'}${j * COLS + i + 1}`,
          // a handful of booths get a holo panel above them
          panel: id % 3 === 0 ? {
            title: ['Live Traffic', 'Lead Score', 'Engagement', 'Dwell Time'][id % 4],
            value: ['142', '8.7', '94%', '6m 12s'][id % 4],
            meta: ['Last 5 min', 'Index', 'Weighted', 'Avg.'][id % 4],
          } : null,
        });
      }
    }
  }
  return booths;
}

// Decorate a baseline layout with real exhibitor data — preserves the spatial
// layout (since real booth coordinates aren't normalized) but replaces labels
// and surfaces real company info on the holo panels.
function decorateBoothsWithExhibitors(booths, exhibitors) {
  if (!exhibitors || exhibitors.length === 0) return booths;
  return booths.map((b, idx) => {
    const ex = exhibitors[idx % exhibitors.length];
    if (!ex) return b;
    const label = ex.companyName || b.label;
    const showPanel = idx % 3 === 0;
    return {
      ...b,
      label,
      panel: showPanel ? {
        title: ex.category || 'Exhibitor',
        value: ex.companyName?.slice(0, 14) || 'EventSphere',
        meta: ex.assignedBooth?.boothNumber
          ? `Booth ${ex.assignedBooth.boothNumber}`
          : 'Confirmed',
      } : null,
    };
  });
}

// Waypoints attendees travel between (booth centers + aisle points)
function buildWaypoints(booths) {
  const pts = booths.map(b => new THREE.Vector3(b.position[0], 0, b.position[2]));
  // add aisle points
  for (let z = -8; z <= 8; z += 4) {
    pts.push(new THREE.Vector3(0, 0, z));
    pts.push(new THREE.Vector3(HALL_A_X + HALL_HALF_W - 1, 0, z));
    pts.push(new THREE.Vector3(HALL_B_X - HALL_HALF_W + 1, 0, z));
  }
  return pts;
}

// Camera waypoints exposed in the HUD
const CAMERA_WAYPOINTS = [
  { id: 'overview',   icon: '🌐', label: 'Overview',     pos: [0, 18, 30],            target: [0, 1.5, 0],  fov: 38 },
  { id: 'hallA',      icon: '◐', label: 'Hall A',       pos: [HALL_A_X - 6, 8, 14],   target: [HALL_A_X, 1.5, 0], fov: 45 },
  { id: 'hallB',      icon: '◑', label: 'Hall B',       pos: [HALL_B_X + 6, 8, 14],   target: [HALL_B_X, 1.5, 0], fov: 45 },
  { id: 'aisle',      icon: '✦', label: 'Networking',   pos: [0, 3.5, 12],            target: [0, 1.5, 0],  fov: 55 },
  { id: 'cinematic',  icon: '◆', label: 'Cinematic',    pos: [16, 4, 18],             target: [-2, 2, -2],  fov: 50 },
];

const NAMES = ['Alex K.', 'Priya R.', 'Marcus B.', 'Sara C.', 'Diego R.', 'Liu Y.', 'Aisha M.', 'Tom K.', 'Jin S.', 'Nora F.'];
const ROLES = ['VP Events', 'Product Lead', 'Design Director', 'CEO', 'CTO', 'Marketing', 'Sales', 'Founder'];
const INTERESTS = [['AI', 'SaaS'], ['DevOps', 'Cloud'], ['Design', 'Motion'], ['Marketing', 'Data'], ['Hardware', 'IoT']];

// Deterministic "live" metrics for a clicked booth, so the detail panel is stable per booth.
function boothStats(b) {
  const s = (b?.id ?? 0) + 1;
  return [
    { label: 'Visitors today', value: 40 + (s * 37) % 180 },
    { label: 'Leads captured', value: 3 + (s * 7) % 32 },
    { label: 'Avg. dwell', value: `${2 + (s % 7)}m ${((s * 13) % 60).toString().padStart(2, '0')}s` },
    { label: 'Engagement', value: `${60 + (s * 9) % 39}%` },
  ];
}

/* ─────────────────────────────────────────────────────────────
   Scene-level booth (small, but more detailed than the preview)
   ───────────────────────────────────────────────────────────── */

function Booth({ booth, hovered, setHovered, onSelect }) {
  const meshRef = useRef();
  const isHovered = hovered === booth.id;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const pulse = 0.55 + Math.sin(t * 1.2 + booth.id) * 0.15;
    meshRef.current.material.emissiveIntensity = isHovered ? 2.0 : pulse;
  });

  return (
    <group position={booth.position}>
      {/* base */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[2.6, 0.12, 2.6]} />
        <meshStandardMaterial color="#0a0a18" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* main pillar */}
      <mesh
        ref={meshRef}
        position={[0, booth.height / 2 + 0.12, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(booth.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
        onClick={(e) => {
          // Only the front-most booth reacts, and don't stopPropagation — so an
          // attendee in the same ray still gets selected (attendees take priority).
          if (e.intersections[0]?.eventObject !== e.eventObject) return;
          onSelect?.(booth);
        }}
        castShadow
      >
        <boxGeometry args={[2, booth.height, 2]} />
        <meshStandardMaterial
          color={booth.color}
          emissive={booth.color}
          emissiveIntensity={0.6}
          metalness={0.5}
          roughness={0.3}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* glow ring underneath */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.65, 32]} />
        <meshBasicMaterial color={booth.color} transparent opacity={isHovered ? 0.95 : 0.35} />
      </mesh>

      {/* booth label */}
      {isHovered && (
        <Html
          position={[0, booth.height + 0.6, 0]}
          center
          distanceFactor={9}
          zIndexRange={[5, 0]}
        >
          <div className="booth-tag">
            <span className="booth-tag-dot" style={{ background: booth.color }} />
            {booth.label}{booth.real ? ` · ${booth.real.status}` : ''}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   Networking link — glowing line between an attendee and 2 nearest booths
   ───────────────────────────────────────────────────────────── */

function NetworkingLines({ from, to, color = '#00ff88' }) {
  const lineGeomA = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([from, to[0]]);
    return g;
  }, [from, to]);
  const lineGeomB = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([from, to[1]]);
    return g;
  }, [from, to]);

  return (
    <group>
      <line geometry={lineGeomA}>
        <lineBasicMaterial color={color} transparent opacity={0.85} linewidth={2} />
      </line>
      <line geometry={lineGeomB}>
        <lineBasicMaterial color={color} transparent opacity={0.85} linewidth={2} />
      </line>

      {/* endpoint dots on the booths */}
      {to.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   World — assembles hall, booths, panels, attendees, networking
   ───────────────────────────────────────────────────────────── */

function World({ booths, waypoints, selectedAttendee, onSelectAttendee, setAttendeePos, onSelectBooth }) {
  const [hovered, setHovered] = useState(null);

  // when an attendee is selected, find their 2 nearest booths
  const networkingTargets = useMemo(() => {
    if (!selectedAttendee) return null;
    const from = selectedAttendee.position;
    const sorted = booths
      .map(b => ({ ...b, _d: Math.hypot(b.position[0] - from.x, b.position[2] - from.z) }))
      .sort((a, b) => a._d - b._d)
      .slice(0, 2);
    return sorted.map(b => new THREE.Vector3(b.position[0], b.height / 2 + 0.4, b.position[2]));
  }, [selectedAttendee, booths]);

  return (
    <>
      <color attach="background" args={['#03030a']} />
      <fog attach="fog" args={['#03030a', 20, 70]} />

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 14, 10]} intensity={0.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[HALL_A_X, 6, 0]} color="#00d4ff" intensity={45} distance={28} />
      <pointLight position={[HALL_B_X, 6, 0]} color="#ff006e" intensity={45} distance={28} />
      <pointLight position={[0, 5, 10]} color="#7b2ff7" intensity={35} distance={22} />

      {/* Two halls */}
      <HallStructure position={[HALL_A_X, 0, 0]} width={HALL_HALF_W * 2} depth={HALL_DEPTH} height={HALL_HEIGHT} accent="#00d4ff" />
      <HallStructure position={[HALL_B_X, 0, 0]} width={HALL_HALF_W * 2} depth={HALL_DEPTH} height={HALL_HEIGHT} accent="#ff006e" />

      {/* Booths */}
      {booths.map((b) => (
        <Booth key={b.id} booth={b} hovered={hovered} setHovered={setHovered} onSelect={onSelectBooth} />
      ))}

      {/* Holo panels above selected booths */}
      <Float speed={0.8} rotationIntensity={0} floatIntensity={0.15}>
        {booths.filter(b => b.panel).map((b) => (
          <HoloPanel
            key={`hp-${b.id}`}
            position={[b.position[0], b.height + 2.2, b.position[2]]}
            width={2.6}
            height={1.5}
            color1={b.color}
            color2="#7b2ff7"
          >
            <div className="hpc-title">{b.panel.title}</div>
            <div className="hpc-value">{b.panel.value}</div>
            <div className="hpc-meta">{b.panel.meta}</div>
          </HoloPanel>
        ))}
      </Float>

      {/* Attendees */}
      <InstancedAttendees
        count={140}
        waypoints={waypoints}
        selectedId={selectedAttendee?.id ?? null}
        onSelect={(i) => onSelectAttendee(i, setAttendeePos)}
        bounds={{ minX: HALL_A_X - HALL_HALF_W + 1, maxX: HALL_B_X + HALL_HALF_W - 1, minZ: -HALL_DEPTH / 2 + 1, maxZ: HALL_DEPTH / 2 - 1 }}
      />

      {/* Networking visualization */}
      {selectedAttendee && networkingTargets && (
        <NetworkingLines
          from={new THREE.Vector3(selectedAttendee.position.x, 1.0, selectedAttendee.position.z)}
          to={networkingTargets}
          color={selectedAttendee.color}
        />
      )}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.45} scale={50} blur={2.5} far={8} />
      <Environment preset="city" />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page wrapper
   ───────────────────────────────────────────────────────────── */

export default function ExperiencePage() {
  const navigate = useNavigate();

  // ── REAL DATA ──
  const [expos, setExpos] = useState([]);
  const [activeExpoId, setActiveExpoId] = useState('');
  const [exhibitors, setExhibitors] = useState([]);
  const [realBooths, setRealBooths] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/expos')
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setExpos(list);
        // Default to the first real expo so booths show live status on click (not the synthetic demo).
        setActiveExpoId((cur) => cur || list[0]?._id || '');
      })
      .catch(() => { if (!cancelled) setExpos([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeExpoId) {
      setExhibitors([]);
      setRealBooths([]);
      return;
    }
    let cancelled = false;
    api.get(`/api/exhibitors/expo/${activeExpoId}/public`)
      .then((res) => { if (!cancelled) setExhibitors(res.data?.data || []); })
      .catch(() => { if (!cancelled) setExhibitors([]); });
    // Real booths for this expo — drives status colors + the click-detail panel.
    api.get(`/api/booths/expo/${activeExpoId}`)
      .then((res) => { if (!cancelled) setRealBooths(res.data?.data || []); })
      .catch(() => { if (!cancelled) setRealBooths([]); });
    return () => { cancelled = true; };
  }, [activeExpoId]);

  const activeExpo = expos.find((e) => e._id === activeExpoId) || null;

  const baseLayout = useMemo(() => buildBoothLayout(), []);
  const booths = useMemo(() => {
    const decorated = decorateBoothsWithExhibitors(baseLayout, exhibitors);
    if (!realBooths.length) return decorated;
    // Attach the real booth (by index) and recolor by availability status.
    const statusColor = { available: '#00ff88', reserved: '#ffb300', occupied: '#7b2ff7' };
    return decorated.map((b, idx) => {
      // Cycle real booths across every layout position so Hall A and Hall B are
      // both consistently real (no synthetic fallback when realBooths < layout size).
      const real = realBooths[idx % realBooths.length];
      return {
        ...b,
        real,
        color: statusColor[real.status] || b.color,
        label: real.exhibitor?.company || real.exhibitor?.name || `Booth ${real.boothNumber}`,
      };
    });
  }, [baseLayout, exhibitors, realBooths]);
  const waypoints = useMemo(() => buildWaypoints(booths), [booths]);

  // ── CAMERA ──
  const [activeWp, setActiveWp] = useState('overview');
  const [waypoint, setWaypoint] = useState(CAMERA_WAYPOINTS[0]);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedBooth, setSelectedBooth] = useState(null);

  // ── AUDIO ──
  useEffect(() => {
    return () => audio.stopAmbient();
  }, []);

  // ── CINEMATIC ──
  const [cinematic, setCinematic] = useState(false);
  useEffect(() => {
    if (!cinematic) return;
    const order = ['overview', 'hallA', 'aisle', 'hallB', 'overview'];
    let idx = 0;
    const tick = () => {
      idx = (idx + 1) % order.length;
      const id = order[idx];
      setActiveWp(id);
      setWaypoint(CAMERA_WAYPOINTS.find(w => w.id === id));
      audio.whoosh();
    };
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [cinematic]);

  // First user click anywhere unlocks audio + starts ambient
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const handleFirstGesture = () => {
    if (audioUnlocked) return;
    audio.unlock();
    setAudioUnlocked(true);
  };

  const handleWaypointSelect = (id) => {
    handleFirstGesture();
    audio.click();
    if (id === 'cinematic') {
      setCinematic((v) => !v);
      setActiveWp('cinematic');
      return;
    }
    setCinematic(false);
    setActiveWp(id);
    setWaypoint(CAMERA_WAYPOINTS.find(w => w.id === id));
    audio.whoosh();
  };

  const handleExpoChange = (e) => {
    handleFirstGesture();
    audio.click();
    setActiveExpoId(e.target.value);
  };

  const handleSelectAttendee = (i /*, posAccessor */) => {
    handleFirstGesture();
    audio.chime();
    setSelectedBooth(null);
    const name = NAMES[i % NAMES.length];
    const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2);
    const role = ROLES[i % ROLES.length];
    const interests = INTERESTS[i % INTERESTS.length];
    const palette = ['#00d4ff', '#7b2ff7', '#ff006e', '#ff8a4a', '#a855f7', '#00ff88'];
    const color = palette[i % palette.length];

    const seed = (i * 13.37) % 1;
    const x = THREE.MathUtils.lerp(-12, 12, seed);
    const z = THREE.MathUtils.lerp(-8, 8, (seed * 7) % 1);

    setSelectedAttendee({
      id: i,
      name,
      initials,
      role,
      color,
      visited: 3 + (i % 5),
      connections: 5 + (i % 8),
      interests,
      position: { x, z },
    });

    setActiveWp('aisle');
    setWaypoint(CAMERA_WAYPOINTS.find(w => w.id === 'aisle'));
  };

  const handleClearSelection = () => {
    audio.click();
    setSelectedAttendee(null);
  };

  const handleSelectBooth = (booth) => {
    handleFirstGesture();
    audio.chime();
    setSelectedAttendee(null);
    setSelectedBooth(booth);
  };

  const handleClearBooth = () => {
    audio.click();
    setSelectedBooth(null);
  };

  // expo selector chip rendered into HUD top-right
  const expoSelector = expos.length > 0 ? (
    <div className="exp-hud-expo">
      <span className="exp-hud-expo-label">Expo</span>
      <select value={activeExpoId} onChange={handleExpoChange}>
        <option value="">Demo (synthetic)</option>
        {expos.map((e) => (
          <option key={e._id} value={e._id}>{e.title}</option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <div className="experience-page" onPointerDown={handleFirstGesture}>
      <WebGLBoundary
        fallback={
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24, color: '#f0f0ff', background: 'radial-gradient(ellipse at top, #18062e, #03030a)' }}>
            <div style={{ fontSize: '2.4rem' }}>🛰️</div>
            <h2 style={{ margin: 0 }}>Immersive 3D experience unavailable</h2>
            <p style={{ maxWidth: 460, opacity: 0.7 }}>Your browser or device couldn’t start WebGL. Enable hardware acceleration (or try a different browser) to explore the 3D expo.</p>
            <button onClick={() => navigate('/')} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(123,47,247,0.5)', background: 'rgba(123,47,247,0.2)', color: '#fff', cursor: 'pointer' }}>← Back to site</button>
          </div>
        }
      >
        <Canvas
          shadows
          dpr={[1, 1.7]}
          camera={{ position: CAMERA_WAYPOINTS[0].pos, fov: CAMERA_WAYPOINTS[0].fov }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <World
              booths={booths}
              waypoints={waypoints}
              selectedAttendee={selectedAttendee}
              onSelectAttendee={handleSelectAttendee}
              setAttendeePos={() => {}}
              onSelectBooth={handleSelectBooth}
            />
            <CameraRig waypoint={waypoint} duration={1.6} />
            <PostFX enabled />
          </Suspense>
        </Canvas>
      </WebGLBoundary>

      <ExperienceHUD
        waypoints={CAMERA_WAYPOINTS}
        activeWaypoint={activeWp}
        onWaypointSelect={handleWaypointSelect}
        attendees={140}
        selected={selectedAttendee}
        onClearSelection={handleClearSelection}
        onExit={() => navigate('/')}
        expoSelector={expoSelector}
      />

      {/* Booth status color legend */}
      {realBooths.length > 0 && (
        <div style={{ position: 'absolute', left: '50%', top: 72, transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 14, padding: '8px 14px', background: 'rgba(10,8,24,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: '0.78rem', color: '#f0f0ff', pointerEvents: 'none' }}>
          <span style={{ opacity: 0.6 }}>Booths:</span>
          {[['Available', '#00ff88'], ['Reserved', '#ffb300'], ['Occupied', '#7b2ff7']].map(([l, c]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 8px ${c}` }} />{l}
            </span>
          ))}
        </div>
      )}

      {/* Clicked-booth detail panel */}
      {selectedBooth && (
        <div style={{ position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)', width: 340, maxWidth: '92vw', zIndex: 40, pointerEvents: 'auto', background: 'rgba(10,8,24,0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${selectedBooth.color}66`, borderRadius: 14, padding: '16px 18px', color: '#f0f0ff', boxShadow: `0 14px 50px rgba(0,0,0,0.55), 0 0 26px ${selectedBooth.color}22` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: selectedBooth.color, boxShadow: `0 0 10px ${selectedBooth.color}`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedBooth.label}</div>
              <div style={{ fontSize: '0.76rem', opacity: 0.6 }}>{selectedBooth.real ? `Booth ${selectedBooth.real.boothNumber} · ${selectedBooth.real.size}` : `Hall ${selectedBooth.hall} · Booth #${selectedBooth.id + 1}`}</div>
            </div>
            <button onClick={handleClearBooth} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.15rem', cursor: 'pointer', opacity: 0.7, lineHeight: 1 }}>✕</button>
          </div>
          {selectedBooth.real ? (() => {
            const r = selectedBooth.real;
            const sc = { available: '#00ff88', reserved: '#ffb300', occupied: '#7b2ff7' }[r.status] || '#f0f0ff';
            const rows = [['Status', r.status, sc], ['Size', r.size, null], ['Price', r.price ? `$${r.price}` : 'Free', null]];
            if (r.status !== 'available') rows.push(['Exhibitor', r.exhibitor?.company || r.exhibitor?.name || '—', null]);
            if (r.status !== 'available' && activeExpo) rows.push(['Booked', `${new Date(activeExpo.startDate).toLocaleDateString()} – ${new Date(activeExpo.endDate).toLocaleDateString()}`, null]);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map(([k, v, c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.9rem' }}>
                    <span style={{ opacity: 0.6 }}>{k}</span>
                    <span style={{ fontWeight: 700, color: c || '#f0f0ff', textTransform: (k === 'Status' || k === 'Size') ? 'capitalize' : 'none' }}>{v}</span>
                  </div>
                ))}
                {r.status === 'available' && <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#00ff88' }}>✅ Open for reservation</div>}
              </div>
            );
          })() : (
            <>
              {selectedBooth.panel && (
                <div style={{ fontSize: '0.82rem', opacity: 0.85, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {selectedBooth.panel.title}: <strong style={{ color: selectedBooth.color }}>{selectedBooth.panel.value}</strong>{selectedBooth.panel.meta ? ` · ${selectedBooth.panel.meta}` : ''}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {boothStats(selectedBooth).map(st => (
                  <div key={st.label}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{st.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{st.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {cinematic && <div className="exp-cinematic-overlay" aria-hidden />}
    </div>
  );
}
