import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Custom holographic shader material — Fresnel rim + scanlines + edge fade + flicker
const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

// hash for grain
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  // base gradient
  vec3 col = mix(uColor, uColor2, vUv.y);

  // moving scanlines
  float scan = sin(vUv.y * 220.0 + uTime * 6.0);
  scan = smoothstep(0.4, 1.0, scan) * 0.35;

  // sweep line top -> bottom
  float sweep = smoothstep(0.0, 0.02, abs(vUv.y - fract(uTime * 0.12)));
  sweep = (1.0 - sweep) * 0.4;

  // Fresnel rim
  float fres = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 2.5);

  // edge fade (transparent panel, brighter at edges)
  float edge = smoothstep(0.0, 0.05, vUv.x) * smoothstep(0.0, 0.05, 1.0 - vUv.x) *
               smoothstep(0.0, 0.05, vUv.y) * smoothstep(0.0, 0.05, 1.0 - vUv.y);

  // grain flicker
  float grain = hash(vUv * 400.0 + uTime) * 0.06;

  col += scan + sweep + grain;
  col += fres * 1.4;

  float alpha = uOpacity * (0.18 + fres * 0.8 + sweep * 0.6) * edge;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;

function makeHoloMaterial(color1 = '#00d4ff', color2 = '#7b2ff7', opacity = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export default function HoloPanel({
  position = [0, 4, 0],
  width = 2.4,
  height = 1.4,
  color1 = '#00d4ff',
  color2 = '#7b2ff7',
  children,
  visible = true,
}) {
  const materialRef = useRef();
  const groupRef = useRef();

  const material = useMemo(() => makeHoloMaterial(color1, color2, 1), [color1, color2]);
  materialRef.current = material;

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
    if (groupRef.current) {
      // gentle bob
      const t = state.clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(t * 1.4 + position[0]) * 0.08;
      // face camera (yaw only)
      const cam = state.camera;
      const dx = cam.position.x - groupRef.current.position.x;
      const dz = cam.position.z - groupRef.current.position.z;
      groupRef.current.rotation.y = Math.atan2(dx, dz);
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Holo panel mesh */}
      <mesh material={material}>
        <planeGeometry args={[width, height, 1, 1]} />
      </mesh>

      {/* Anchored DOM content */}
      {children && (
        <Html
          center
          distanceFactor={6}
          zIndexRange={[10, 0]}
          transform={false}
        >
          <div className="holo-panel-content" style={{ width: width * 110, pointerEvents: 'none' }}>
            {children}
          </div>
        </Html>
      )}

      {/* Tether line down to the booth */}
      <mesh position={[0, -height / 2 - 0.6, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.2, 8]} />
        <meshBasicMaterial color={color1} transparent opacity={0.4} />
      </mesh>
      {/* bottom dot */}
      <mesh position={[0, -height / 2 - 1.2, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={color1} />
      </mesh>
    </group>
  );
}
