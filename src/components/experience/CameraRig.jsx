import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';

/**
 * GSAP-driven camera rig.
 *
 * Pass a `waypoint` prop ({ pos, target, fov? }) and the camera will tween
 * to that position over `duration` seconds using a quartic ease.
 *
 * Between tweens the rig adds a tiny "breathing" orbit so the scene stays alive.
 */
export default function CameraRig({ waypoint, duration = 1.6 }) {
  const { camera } = useThree();
  // moving target the camera lookAts every frame
  const lookTarget = useRef(new THREE.Vector3(0, 1.2, 0));
  // current waypoint center (so the breathing orbit is around it)
  const orbitCenter = useRef(new THREE.Vector3(0, 1.2, 0));
  const orbitRadius = useRef(18);
  const orbitHeight = useRef(7);
  const baseAngle = useRef(0);

  useEffect(() => {
    if (!waypoint) return;
    const { pos, target, fov } = waypoint;
    const targetVec = new THREE.Vector3(...target);
    const posVec = new THREE.Vector3(...pos);

    // tween camera position
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(lookTarget.current);
    gsap.killTweensOf(orbitCenter.current);

    gsap.to(camera.position, {
      x: posVec.x,
      y: posVec.y,
      z: posVec.z,
      duration,
      ease: 'power3.inOut',
    });

    gsap.to(lookTarget.current, {
      x: targetVec.x,
      y: targetVec.y,
      z: targetVec.z,
      duration,
      ease: 'power3.inOut',
    });

    gsap.to(orbitCenter.current, {
      x: targetVec.x,
      y: targetVec.y,
      z: targetVec.z,
      duration,
      ease: 'power3.inOut',
    });

    // remember orbit geometry for the breathing pass
    const dx = posVec.x - targetVec.x;
    const dz = posVec.z - targetVec.z;
    orbitRadius.current = Math.hypot(dx, dz);
    orbitHeight.current = posVec.y;
    baseAngle.current = Math.atan2(dx, dz);

    if (fov && fov !== camera.fov) {
      gsap.to(camera, {
        fov,
        duration,
        ease: 'power3.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    }
  }, [waypoint, camera, duration]);

  useFrame((state) => {
    // breathing orbit (slow drift on top of GSAP tween)
    const t = state.clock.getElapsedTime();
    const driftAngle = baseAngle.current + Math.sin(t * 0.08) * 0.05;
    const driftHeight = orbitHeight.current + Math.sin(t * 0.12) * 0.15;

    // We only apply drift when GSAP is NOT currently tweening this property
    // (gsap.isTweening returns true if there is an active tween).
    if (!gsap.isTweening(state.camera.position)) {
      state.camera.position.x = orbitCenter.current.x + Math.sin(driftAngle) * orbitRadius.current;
      state.camera.position.z = orbitCenter.current.z + Math.cos(driftAngle) * orbitRadius.current;
      state.camera.position.y = driftHeight;
    }

    state.camera.lookAt(lookTarget.current);
  });

  return null;
}
