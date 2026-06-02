import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WebGLBoundary from './WebGLBoundary';
import './BoothFloor3D.css';

// Real-data 3D floor plan: one box per Booth, colored by status, sized by booth size.
const STATUS_COLOR = { available: '#00ff88', reserved: '#ffb300', occupied: '#7b2ff7' };
const SIZE_HEIGHT = { small: 0.7, medium: 1.1, large: 1.6, 'extra-large': 2.2 };
const SIZE_FOOT = { small: 0.85, medium: 1.0, large: 1.18, 'extra-large': 1.35 };

function Booth({ booth, x, z, hovered, setHovered, onSelect }) {
  const meshRef = useRef();
  const isHovered = hovered === booth._id;
  const color = STATUS_COLOR[booth.status] || '#00d4ff';
  const h = SIZE_HEIGHT[booth.size] || 1.1;
  const foot = SIZE_FOOT[booth.size] || 1.0;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.material.emissiveIntensity = isHovered ? 1.8 : 0.5 + Math.sin(t * 1.5 + x + z) * 0.12;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={meshRef}
        position={[0, h / 2, 0]}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(booth._id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(booth); }}
      >
        <boxGeometry args={[foot, h, foot]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.4} roughness={0.35} transparent opacity={0.92} />
      </mesh>

      {/* glow ring underneath */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[foot * 0.62, foot * 0.74, 28]} />
        <meshBasicMaterial color={color} transparent opacity={isHovered ? 0.9 : 0.3} />
      </mesh>

      {isHovered && (
        <Html position={[0, h + 0.5, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <div className="booth-tag">
            <span className="booth-tag-dot" style={{ background: color }} />
            {booth.boothNumber} · {booth.status}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({ booths, hovered, setHovered, onSelect }) {
  // Lay booths out on a near-square grid.
  const placed = useMemo(() => {
    const n = booths.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const spacing = 1.7;
    return booths.map((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rows = Math.ceil(n / cols);
      return { booth: b, x: (col - (cols - 1) / 2) * spacing, z: (row - (rows - 1) / 2) * spacing };
    });
  }, [booths]);

  const span = Math.max(8, Math.ceil(Math.sqrt(booths.length)) * 1.7 + 4);

  return (
    <>
      <color attach="background" args={['#06061a']} />
      <fog attach="fog" args={['#06061a', span * 1.4, span * 3]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[6, 12, 6]} intensity={0.7} castShadow />
      <pointLight position={[-8, 7, -8]} color="#7b2ff7" intensity={35} distance={span * 2} />
      <pointLight position={[8, 7, 8]} color="#00d4ff" intensity={35} distance={span * 2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span * 2, span * 2]} />
        <meshStandardMaterial color="#0a0a1a" metalness={0.6} roughness={0.5} />
      </mesh>
      <gridHelper args={[span * 2, Math.round(span * 2), '#7b2ff7', '#1a1a3a']} position={[0, 0.001, 0]} />

      {placed.map(({ booth, x, z }) => (
        <Booth key={booth._id} booth={booth} x={x} z={z} hovered={hovered} setHovered={setHovered} onSelect={onSelect} />
      ))}

      <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={span * 2} blur={2.5} far={8} />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={6} maxDistance={span * 2.5} maxPolarAngle={Math.PI / 2.2} />
      <Environment preset="city" />
    </>
  );
}

export default function Booth3DView({ booths = [], onSelectBooth }) {
  const [hovered, setHovered] = useState(null);
  const [inView, setInView] = useState(false);
  const stageRef = useRef(null);
  const span = Math.max(8, Math.ceil(Math.sqrt(booths.length || 1)) * 1.7 + 4);

  // Pause the render loop while the stage is scrolled out of view.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [booths.length]);

  if (!booths.length) {
    return <div className="booth3d-fallback"><span>🧊</span><p>No booths to display in 3D yet.</p></div>;
  }

  return (
    <div ref={stageRef} className="booth3d-view-stage" data-lenis-prevent style={{ position: 'relative', height: 460, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <WebGLBoundary fallback={<div className="booth3d-fallback"><span>🛰️</span><p>3D view needs WebGL (hardware acceleration). Use the Grid or Floor Plan view instead.</p></div>}>
        <Canvas shadows dpr={[1, 1.5]} frameloop={inView ? 'always' : 'never'} camera={{ position: [span, span * 0.8, span], fov: 45 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
          <Suspense fallback={null}>
            <Scene booths={booths} hovered={hovered} setHovered={setHovered} onSelect={onSelectBooth} />
          </Suspense>
        </Canvas>
      </WebGLBoundary>
      <div className="booth3d-overlay-corner top-left"><span className="booth3d-pulse" />{booths.length} booths · drag to orbit · scroll to zoom</div>
      <div className="booth3d-overlay-corner top-right" style={{ display: 'flex', gap: 10 }}>
        {[['Available', '#00ff88'], ['Reserved', '#ffb300'], ['Occupied', '#7b2ff7']].map(([l, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}
