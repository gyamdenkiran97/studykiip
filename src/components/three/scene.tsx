"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import type { Group, Mesh } from "three";

/**
 * The actual WebGL scene. Loaded only when the showcase scrolls into view, and
 * never on a device that has told us it prefers reduced motion or has few
 * cores — see showcase.tsx for those gates.
 *
 * Deliberately geometry-only: no downloaded model, no texture atlas, no
 * post-processing. It reads as a premium product plinth and costs almost
 * nothing to ship.
 */

function Plinth() {
  return (
    <mesh position={[0, -0.92, 0]} receiveShadow>
      <cylinderGeometry args={[1.35, 1.45, 0.16, 64]} />
      <meshStandardMaterial color="#E5E0D5" roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

function Subject({ spin }: { spin: boolean }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (spin) {
      group.current.rotation.y += delta * 0.32;
    }
    // A breath of movement tied to the pointer keeps it feeling live without
    // hijacking scroll.
    const targetX = state.pointer.y * 0.12;
    const targetZ = state.pointer.x * -0.08;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
    group.current.rotation.z += (targetZ - group.current.rotation.z) * 0.04;
    if (ring.current && spin) ring.current.rotation.z += delta * 0.18;
  });

  return (
    <group ref={group}>
      <RoundedBox args={[1.5, 1.5, 1.5]} radius={0.22} smoothness={6} castShadow>
        <meshStandardMaterial color="#2A2724" roughness={0.36} metalness={0.22} />
      </RoundedBox>
      <mesh ref={ring} rotation={[Math.PI / 2.6, 0, 0]} castShadow>
        <torusGeometry args={[1.32, 0.055, 24, 96]} />
        <meshStandardMaterial color="#A8452B" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.62, 0.86, 0.62]} castShadow>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#A6802F" roughness={0.22} metalness={0.65} />
      </mesh>
    </group>
  );
}

export default function Scene({ spin = true, dpr = 1.5 }: { spin?: boolean; dpr?: number }) {
  const camera = useMemo(() => ({ position: [0, 0.6, 5.2] as [number, number, number], fov: 38 }), []);

  return (
    <Canvas
      camera={camera}
      dpr={[1, dpr]}
      shadows
      gl={{ antialias: true, powerPreference: "low-power" }}
      // The canvas is decorative; its meaning is carried by the surrounding copy.
      aria-hidden="true"
      style={{ touchAction: "pan-y" }}
    >
      <color attach="background" args={["#F3EFE7"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3.5, 5, 2.5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#C8A882" />
      {/* A warm key and a cool fill stand in for an environment map: no HDR is
          fetched, so the scene has no runtime network dependency at all. */}
      <hemisphereLight args={["#FBF9F5", "#8A8175", 0.7]} />
      <pointLight position={[-2.2, -1.4, 3]} intensity={12} color="#A8452B" distance={9} decay={2} />
      <Suspense fallback={null}>
        <Subject spin={spin} />
        <Plinth />
        <ContactShadows position={[0, -1.02, 0]} opacity={0.32} scale={7} blur={2.6} far={3} />
      </Suspense>
    </Canvas>
  );
}
