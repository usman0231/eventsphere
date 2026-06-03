import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const dummyObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

/**
 * Instanced animated attendees walking between random waypoints.
 *
 * - Each agent has a current position, a target waypoint, and a speed.
 * - When close to its waypoint it picks a new random one from the supplied set.
 * - Speed and color vary per agent.
 * - One mesh, one draw call.
 */
export default function InstancedAttendees({
  count = 140,
  waypoints,
  onSelect,
  selectedId = null,
  bounds = { minX: -16, maxX: 16, minZ: -10, maxZ: 10 },
}) {
  const meshRef = useRef();
  const colorAttrRef = useRef();

  // per-agent state
  const agents = useMemo(() => {
    return Array.from({ length: count }).map(() => {
      const x = THREE.MathUtils.randFloat(bounds.minX, bounds.maxX);
      const z = THREE.MathUtils.randFloat(bounds.minZ, bounds.maxZ);
      return {
        pos: new THREE.Vector3(x, 0, z),
        target: waypoints[Math.floor(Math.random() * waypoints.length)].clone(),
        speed: THREE.MathUtils.randFloat(0.7, 1.6),
        wobble: Math.random() * Math.PI * 2,
        baseHue: THREE.MathUtils.randFloat(0, 1),
      };
    });
  }, [count, waypoints, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ]);

  // initial colors
  useEffect(() => {
    if (!colorAttrRef.current) return;
    const palette = ['#00d4ff', '#7b2ff7', '#ff006e', '#ff8a4a', '#a855f7', '#00ff88'];
    agents.forEach((_, i) => {
      tmpColor.set(palette[i % palette.length]);
      colorAttrRef.current.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    });
    colorAttrRef.current.needsUpdate = true;
  }, [agents]);

  // animate
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const clampedDelta = Math.min(delta, 0.05);

    agents.forEach((a, i) => {
      const toX = a.target.x - a.pos.x;
      const toZ = a.target.z - a.pos.z;
      const dist = Math.hypot(toX, toZ);

      if (dist < 0.4) {
        // pick a new waypoint, avoid the same one twice
        let next;
        let tries = 0;
        do {
          next = waypoints[Math.floor(Math.random() * waypoints.length)];
          tries++;
        } while (next.equals(a.target) && tries < 4);
        a.target = next.clone();
      } else {
        const nx = toX / dist;
        const nz = toZ / dist;
        a.pos.x += nx * a.speed * clampedDelta;
        a.pos.z += nz * a.speed * clampedDelta;
      }

      // gentle bob
      const bob = Math.sin(t * 4 + a.wobble) * 0.04;

      // selected agent is bigger and lifted
      const isSelected = selectedId === i;
      const scale = isSelected ? 1.6 : 1.0;
      const yLift = isSelected ? 0.25 : 0;

      dummyObj.position.set(a.pos.x, 0.55 + bob + yLift, a.pos.z);
      // face direction of travel
      dummyObj.rotation.y = Math.atan2(toX, toZ);
      dummyObj.scale.setScalar(scale);
      dummyObj.updateMatrix();
      meshRef.current.setMatrixAt(i, dummyObj.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, count]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(e.instanceId);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      {/* Stylized "person" — capsule body + sphere head, kept ultra-light */}
      <capsuleGeometry args={[0.22, 0.55, 4, 8]} />
      <meshStandardMaterial
        vertexColors
        emissive="#ffffff"
        emissiveIntensity={0.25}
        metalness={0.2}
        roughness={0.55}
        toneMapped
      />
      <instancedBufferAttribute
        ref={colorAttrRef}
        attach="instanceColor"
        args={[new Float32Array(count * 3), 3]}
      />
    </instancedMesh>
  );
}

// Exported helper: get the live position of an agent at index i.
// The page uses this to draw networking link-lines.
export function makeAgentPositionAccessor(meshRef) {
  return (i) => {
    if (!meshRef.current) return null;
    const m = new THREE.Matrix4();
    meshRef.current.getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m);
  };
}
