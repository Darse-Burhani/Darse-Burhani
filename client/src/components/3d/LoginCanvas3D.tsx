import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere } from "@react-three/drei";
import * as THREE from "three";

// ── Premium palette: champagne gold + deep emerald + ivory ──
const CHAMPAGNE = "#d9c48f";
const GOLD_DEEP = "#b08d3e";
const EMERALD_DEEP = "#07352a";
const EMERALD_SOFT = "#0e6b54";
const IVORY = "#f3ead2";

// ── Slow, elegant orbiting accent nodes (monochrome gold) ──
function OrbitingAccents() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
      groupRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
    }
  });

  const nodes = useMemo(
    () => [
      { pos: [2.5, 0.35, 0] as const, size: 0.055, color: CHAMPAGNE },
      { pos: [-2.5, -0.3, 0.4] as const, size: 0.045, color: IVORY },
      { pos: [0, 0.3, 2.5] as const, size: 0.05, color: CHAMPAGNE },
      { pos: [0, -0.35, -2.5] as const, size: 0.04, color: GOLD_DEEP },
    ],
    []
  );

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <group key={i} position={node.pos}>
          <Sphere args={[node.size, 20, 20]}>
            <meshStandardMaterial
              color={node.color}
              metalness={0.9}
              roughness={0.25}
              emissive={node.color}
              emissiveIntensity={0.35}
            />
          </Sphere>
          <pointLight color={CHAMPAGNE} intensity={0.55} distance={2.6} decay={2} />
        </group>
      ))}
    </group>
  );
}

// ── Premium central emblem: faceted gem + thin concentric gold rings ──
function PremiumEmblem() {
  const gemRef = useRef<THREE.Mesh>(null);
  const gemWireRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const ringCRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (gemRef.current) {
      gemRef.current.rotation.y += delta * 0.16;
      gemRef.current.rotation.x = Math.sin(t * 0.25) * 0.12;
      const s = 1 + Math.sin(t * 1.1) * 0.018;
      gemRef.current.scale.set(s, s, s);
    }
    if (gemWireRef.current) {
      gemWireRef.current.rotation.y -= delta * 0.1;
      gemWireRef.current.rotation.z += delta * 0.05;
    }
    if (ringARef.current) {
      ringARef.current.rotation.z += delta * 0.12;
      ringARef.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.3) * 0.06;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z -= delta * 0.09;
      ringBRef.current.rotation.y = Math.sin(t * 0.22) * 0.18;
    }
    if (ringCRef.current) {
      ringCRef.current.rotation.z += delta * 0.06;
    }
    if (haloRef.current) {
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.1 + Math.sin(t * 0.9) * 0.025;
    }
  });

  return (
    <Float speed={0.9} rotationIntensity={0.18} floatIntensity={0.45}>
      <group position={[0, 0.1, 0]}>
        {/* Soft halo backdrop — subtle depth glow */}
        <mesh ref={haloRef}>
          <sphereGeometry args={[1.9, 32, 32]} />
          <meshBasicMaterial
            color={EMERALD_SOFT}
            transparent
            opacity={0.1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Central faceted gem — deep emerald glass */}
        <mesh ref={gemRef}>
          <icosahedronGeometry args={[0.72, 0]} />
          <meshPhysicalMaterial
            color={EMERALD_DEEP}
            emissive={EMERALD_SOFT}
            emissiveIntensity={0.32}
            roughness={0.08}
            metalness={0.15}
            transmission={0.85}
            thickness={2.2}
            clearcoat={1}
            clearcoatRoughness={0.12}
            ior={1.45}
            transparent
            opacity={0.96}
          />
        </mesh>

        {/* Fine gold lattice over gem — barely visible, couture detail */}
        <mesh ref={gemWireRef} scale={1.004}>
          <icosahedronGeometry args={[0.72, 1]} />
          <meshBasicMaterial
            color={CHAMPAGNE}
            wireframe
            transparent
            opacity={0.14}
          />
        </mesh>

        {/* Inner bright core */}
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshBasicMaterial color={IVORY} transparent opacity={0.85} />
        </mesh>
        <pointLight color={CHAMPAGNE} intensity={0.9} distance={4} decay={2} />

        {/* Ring A — primary champagne band */}
        <mesh ref={ringARef} rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[1.75, 0.014, 16, 128]} />
          <meshStandardMaterial
            color={CHAMPAGNE}
            metalness={1}
            roughness={0.22}
            emissive={GOLD_DEEP}
            emissiveIntensity={0.28}
          />
        </mesh>

        {/* Ring B — wide tilted orbit, muted */}
        <mesh ref={ringBRef} rotation={[Math.PI / 2.2, 0.35, 0]}>
          <torusGeometry args={[2.3, 0.01, 16, 128]} />
          <meshStandardMaterial
            color={GOLD_DEEP}
            metalness={1}
            roughness={0.3}
            emissive={GOLD_DEEP}
            emissiveIntensity={0.22}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Ring C — hairline outer, ultra thin */}
        <mesh ref={ringCRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.75, 0.007, 12, 128]} />
          <meshBasicMaterial color={CHAMPAGNE} transparent opacity={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

// ── Subtle architectural floor reflection grid ──
function PremiumFloorGrid() {
  const meshRef = useRef<THREE.Points>(null);
  const rows = 32;
  const cols = 32;
  const count = rows * cols;

  const [positions, initialY] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const initY = new Float32Array(count);
    const spacing = 0.52;
    const xOffset = (cols * spacing) / 2;
    const zOffset = (rows * spacing) / 2;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * spacing - xOffset;
        const z = r * spacing - zOffset;
        const y = Math.sin(x * 0.32) * Math.cos(z * 0.32) * 0.35 - 2.4;

        pos[idx * 3] = x;
        pos[idx * 3 + 1] = y;
        pos[idx * 3 + 2] = z;
        initY[idx] = y;
        idx++;
      }
    }
    return [pos, initY];
  }, [rows, cols, count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const posAttr = meshRef.current.geometry.attributes.position;
    const time = state.clock.elapsedTime * 0.55;

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const wave =
        Math.sin(x * 0.32 + time) * Math.cos(z * 0.32 + time * 0.7) * 0.32;
      posAttr.setY(i, initialY[i] + wave);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef} position={[0, -0.5, -1]} rotation={[-Math.PI / 7, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#145843"
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Sparse champagne dust — slow, refined ──
function PremiumDust({ count = 70 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const champagne = new THREE.Color(CHAMPAGNE);
    const ivory = new THREE.Color(IVORY);
    const emerald = new THREE.Color("#1d7a5f");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 7;

      const r = Math.random();
      const chosen = r > 0.6 ? champagne : r > 0.3 ? ivory : emerald;
      col[i * 3] = chosen.r;
      col[i * 3 + 1] = chosen.g;
      col[i * 3 + 2] = chosen.b;
    }

    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.015;
      pointsRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.08) * 0.015;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Gentle camera parallax — restrained for executive feel ──
function CameraParallaxRig({ mousePos }: { mousePos: { x: number; y: number } }) {
  useFrame((state) => {
    const targetX = mousePos.x * 0.38;
    const targetY = -mousePos.y * 0.28;

    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      targetX,
      0.025
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      targetY,
      0.025
    );
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}

// ── Main premium scene ──
export function LoginCanvas3D({
  mousePos = { x: 0, y: 0 },
}: {
  mousePos?: { x: number; y: number };
}) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
      >
        {/* Cinematic depth fade */}
        <fog attach="fog" args={["#01140f", 7.5, 14]} />

        {/* Soft studio lighting — warm key, cool emerald rim */}
        <ambientLight intensity={0.5} color={IVORY} />
        <pointLight position={[4, 3.5, 4]} intensity={1.4} color={CHAMPAGNE} />
        <pointLight position={[-4, -2.5, 3]} intensity={1.1} color={EMERALD_SOFT} />
        <pointLight position={[0, 0.5, 2.5]} intensity={0.7} color={IVORY} />
        <directionalLight position={[0, 6, 5]} intensity={0.55} color="#ffffff" />

        <CameraParallaxRig mousePos={mousePos} />
        <PremiumEmblem />
        <OrbitingAccents />
        <PremiumFloorGrid />
        <PremiumDust count={70} />
      </Canvas>

      {/* Premium cinematic vignette + top sheen (CSS, zero GPU cost) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 42%, transparent 40%, rgba(1,12,9,0.55) 78%, rgba(1,12,9,0.9) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(217,196,143,0.06), transparent)",
        }}
      />
    </div>
  );
}
