import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WebGLBoundary from './WebGLBoundary';

const COLORS = ['#7b2ff7', '#ff006e', '#00d4ff', '#ff6b35', '#a855f7', '#22d3ee'];

// Deterministic pseudo-random so the layout doesn't reshuffle each render
function rng(seed) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
}

function buildBooths() {
  const out = [];
  const r = rng(42);
  const COLS = 6;
  const ROWS = 5;
  const spacing = 1.6;
  let id = 0;
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const x = (i - (COLS - 1) / 2) * spacing;
      const z = (j - (ROWS - 1) / 2) * spacing;
      const h = 0.6 + r() * 1.6;
      const color = COLORS[Math.floor(r() * COLORS.length)];
      out.push({ id: id++, position: [x, h / 2, z], height: h, color, label: `Booth ${String.fromCharCode(65 + i)}${j + 1}` });
    }
  }
  return out;
}

function Booth({ booth, hovered, setHovered }) {
  const meshRef = useRef();
  const isHovered = hovered === booth.id;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    // gentle pulse on emissive
    const pulse = 0.6 + Math.sin(t * 1.5 + booth.id) * 0.15;
    meshRef.current.material.emissiveIntensity = isHovered ? 2.2 : pulse;
    // hover lift
    const targetY = booth.position[1] + (isHovered ? 0.35 : 0);
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.15;
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={booth.position}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(booth.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = 'auto'; }}
        castShadow
      >
        <boxGeometry args={[1.05, booth.height, 1.05]} />
        <meshStandardMaterial
          color={booth.color}
          emissive={booth.color}
          emissiveIntensity={0.6}
          metalness={0.4}
          roughness={0.3}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* glow ring under each booth */}
      <mesh position={[booth.position[0], 0.01, booth.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.78, 32]} />
        <meshBasicMaterial color={booth.color} transparent opacity={isHovered ? 0.9 : 0.35} />
      </mesh>

      {isHovered && (
        <Html
          position={[booth.position[0], booth.position[1] + booth.height / 2 + 0.6, booth.position[2]]}
          center
          distanceFactor={8}
          zIndexRange={[10, 0]}
        >
          <div className="booth-tag">
            <span className="booth-tag-dot" style={{ background: booth.color }} />
            {booth.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Floor() {
  return (
    <>
      {/* grid floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#0a0a1a" metalness={0.6} roughness={0.5} />
      </mesh>
      <gridHelper args={[24, 24, '#7b2ff7', '#1a1a3a']} position={[0, 0.001, 0]} />
    </>
  );
}

// Drifting particles overhead — pure points cloud
function Particles({ count = 200 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = Math.random() * 6 + 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#00d4ff" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function Scene({ hovered, setHovered }) {
  const booths = useMemo(() => buildBooths(), []);
  return (
    <>
      <color attach="background" args={['#05050f']} />
      <fog attach="fog" args={['#05050f', 12, 28]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 10, 6]} intensity={0.7} castShadow />
      <pointLight position={[-8, 6, -8]} color="#7b2ff7" intensity={40} distance={20} />
      <pointLight position={[8, 6, 8]} color="#00d4ff" intensity={40} distance={20} />
      <pointLight position={[0, 8, 0]} color="#ff006e" intensity={25} distance={18} />

      <Floor />
      <Particles count={120} />

      <Float speed={1.2} rotationIntensity={0} floatIntensity={0.2}>
        {booths.map((b) => (
          <Booth key={b.id} booth={b} hovered={hovered} setHovered={setHovered} />
        ))}
      </Float>

      <ContactShadows position={[0, 0.02, 0]} opacity={0.4} scale={20} blur={2.5} far={6} />
      <OrbitControls
        makeDefault
        target={[0, 0.5, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.4}
      />
      <Environment preset="city" />
    </>
  );
}

export default function BoothFloor3D() {
  const [hovered, setHovered] = useState(null);
  const [inView, setInView] = useState(false);
  const stageRef = useRef(null);

  // Only run the WebGL render loop while the section is on screen — saves GPU/CPU
  // and keeps scrolling smooth when it's scrolled past.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="booth3d-section">
      <div className="booth3d-header">
        <div className="booth3d-tag">Interactive Floor Plan</div>
        <h2 className="booth3d-title">Walk the Expo. In 3D.</h2>
        <p className="booth3d-sub">
          Every booth, every aisle, every session — visualized live. Hover a booth to inspect occupancy,
          leads, and engagement in real time.
        </p>
      </div>

      <div className="booth3d-stage" ref={stageRef}>
        <WebGLBoundary
          fallback={
            <div className="booth3d-fallback">
              <span style={{ fontSize: '2rem' }}>🛰️</span>
              <p>Interactive 3D floor preview isn’t available on this device.</p>
              <small>Enable hardware acceleration / WebGL in your browser to view it.</small>
            </div>
          }
        >
          <Canvas
            shadows
            dpr={[1, 1.5]}
            frameloop={inView ? 'always' : 'never'}
            camera={{ position: [11, 7, 11], fov: 45 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <Scene hovered={hovered} setHovered={setHovered} />
            </Suspense>
          </Canvas>
        </WebGLBoundary>

        <div className="booth3d-overlay-corner top-left">
          <span className="booth3d-pulse" />
          LIVE · 30 booths
        </div>
        <div className="booth3d-overlay-corner top-right">
          Drag to look · auto-orbits
        </div>
        <div className="booth3d-overlay-corner bottom-left">
          Hall A · Ground Floor
        </div>
        <div className="booth3d-overlay-corner bottom-right">
          {hovered !== null ? `Inspecting ${String.fromCharCode(65 + Math.floor(hovered / 5))}${(hovered % 5) + 1}` : 'Hover any booth →'}
        </div>
      </div>
    </section>
  );
}
