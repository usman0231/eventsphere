import React, { useMemo } from 'react';
import * as THREE from 'three';

// Sci-fi exhibition hall: reflective floor, glass-strip perimeter walls, ceiling truss + light bars.
// Designed so two halls sit side-by-side with a center aisle.
export default function HallStructure({
  position = [0, 0, 0],
  width = 18,
  depth = 24,
  height = 8,
  accent = '#00d4ff',
}) {
  // Build a couple of reusable geometries
  const beamGeom = useMemo(() => new THREE.BoxGeometry(width + 2, 0.18, 0.4), [width]);
  const sideBeamGeom = useMemo(() => new THREE.BoxGeometry(0.4, 0.18, depth + 2), [depth]);

  return (
    <group position={position}>
      {/* Floor with subtle metallic finish */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#0a0a18"
          metalness={0.85}
          roughness={0.35}
          envMapIntensity={0.6}
        />
      </mesh>

      {/* Floor grid lines (drawn as a slightly raised plane) */}
      <gridHelper
        args={[Math.max(width, depth), Math.max(width, depth) / 1.5, accent, '#181838']}
        position={[0, 0.002, 0]}
      />

      {/* PERIMETER WALLS — semi-transparent glass with neon trim */}
      {/* back wall */}
      <mesh position={[0, height / 2, -depth / 2]}>
        <boxGeometry args={[width, height, 0.15]} />
        <meshStandardMaterial color="#0a0a1a" transparent opacity={0.55} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* front wall */}
      <mesh position={[0, height / 2, depth / 2]}>
        <boxGeometry args={[width, height, 0.15]} />
        <meshStandardMaterial color="#0a0a1a" transparent opacity={0.55} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* side walls */}
      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[0.15, height, depth]} />
        <meshStandardMaterial color="#0a0a1a" transparent opacity={0.55} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[0.15, height, depth]} />
        <meshStandardMaterial color="#0a0a1a" transparent opacity={0.55} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Neon trim strips along the top edge of each wall */}
      {[
        [0, height - 0.05, -depth / 2 + 0.1, width, 0.04, 0.04],
        [0, height - 0.05, depth / 2 - 0.1, width, 0.04, 0.04],
        [-width / 2 + 0.1, height - 0.05, 0, 0.04, 0.04, depth],
        [width / 2 - 0.1, height - 0.05, 0, 0.04, 0.04, depth],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      ))}

      {/* Neon trim strips along the bottom edge (floor glow) */}
      {[
        [0, 0.02, -depth / 2 + 0.1, width, 0.04, 0.04],
        [0, 0.02, depth / 2 - 0.1, width, 0.04, 0.04],
        [-width / 2 + 0.1, 0.02, 0, 0.04, 0.04, depth],
        [width / 2 - 0.1, 0.02, 0, 0.04, 0.04, depth],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={`b${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      ))}

      {/* CEILING TRUSS — beams every 4m + light bars */}
      {Array.from({ length: 5 }).map((_, i) => {
        const t = -depth / 2 + 2 + i * ((depth - 4) / 4);
        return (
          <group key={`truss-${i}`} position={[0, height - 0.6, t]}>
            <mesh geometry={beamGeom}>
              <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.5} />
            </mesh>
            {/* light bar under the beam */}
            <mesh position={[0, -0.22, 0]}>
              <boxGeometry args={[width - 1, 0.08, 0.18]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* soft light cast from each truss */}
            <pointLight position={[0, -0.5, 0]} intensity={6} distance={12} color="#e8f4ff" />
          </group>
        );
      })}

      {/* Side beams running depth-wise */}
      {[-width / 2 + 1, width / 2 - 1].map((x, i) => (
        <mesh key={`sb-${i}`} position={[x, height - 0.6, 0]} geometry={sideBeamGeom}>
          <meshStandardMaterial color="#1a1a2e" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}

      {/* Corner accent pillars */}
      {[
        [-width / 2 + 0.3, height / 2, -depth / 2 + 0.3],
        [width / 2 - 0.3, height / 2, -depth / 2 + 0.3],
        [-width / 2 + 0.3, height / 2, depth / 2 - 0.3],
        [width / 2 - 0.3, height / 2, depth / 2 - 0.3],
      ].map((p, i) => (
        <group key={`p-${i}`} position={p}>
          <mesh>
            <boxGeometry args={[0.3, height, 0.3]} />
            <meshStandardMaterial color="#0a0a18" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, height, 0.06]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
