"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export interface Tree3DBranch {
  marhala: string;
  shortLabel: string;
  totalStudents: number;
  unassigned: number;
  colorHex: string;
}

interface MarhalaTree3DProps {
  branches: Tree3DBranch[];
  selected: string | null;
  onSelect: (marhala: string) => void;
  academicYear: string;
}

// Professional light-theme labels: white pill, dark slate text.
function makeLabelTexture(lines: { text: string; font: string; color: string }[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 256);
  const lineHeight = 256 / (lines.length + 0.6);
  lines.forEach((l, i) => {
    ctx.font = l.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(l.text).width + 52;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    const y = lineHeight * (i + 0.8);
    ctx.beginPath();
    ctx.roundRect(256 - w / 2, y - lineHeight / 2 + 6, w, lineHeight - 12, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,0.14)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, 256, y + 6);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 448;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 448);
  grad.addColorStop(0, "#7c4a21");
  grad.addColorStop(0.5, "#5d3617");
  grad.addColorStop(1, "#42240e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 448);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const y = 30 + i * 46;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(300, y + 14, 700, y - 14, 1024, y + 8);
    ctx.stroke();
  }
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, 984, 408);
  ctx.strokeStyle = "rgba(251,191,36,0.4)";
  ctx.lineWidth = 4;
  ctx.strokeRect(44, 44, 936, 360);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fef3c7";
  ctx.font = "bold 118px Georgia, serif";
  ctx.fillText(title, 512, 218);
  ctx.fillStyle = "#fcd34d";
  ctx.font = "bold 54px Georgia, serif";
  ctx.fillText(subtitle, 512, 330);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6b4423";
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const dark = Math.random() > 0.4;
    ctx.strokeStyle = dark ? "rgba(30,17,6,0.5)" : "rgba(150,104,58,0.4)";
    ctx.lineWidth = 1 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.bezierCurveTo(x + 12, 150, x - 12, 340, x + 6, 522);
    ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const r = 5 + Math.random() * 9;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, "rgba(25,14,5,0.9)");
    g.addColorStop(1, "rgba(25,14,5,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Deterministic pseudo-random for stable placement
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function usePrefersReducedMotion(): boolean {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
}

interface BranchLayout {
  branch: Tree3DBranch;
  end: THREE.Vector3;
  mid: THREE.Vector3;
  foliage: { pos: THREE.Vector3; scale: number; phase: number; tone: number }[];
}

function useTreeLayout(branches: Tree3DBranch[]): BranchLayout[] {
  return useMemo(() => {
    const n = Math.max(branches.length, 1);
    return branches.map((branch, i) => {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const x = (t - 0.5) * 9;
      const arc = Math.abs(t - 0.5) * 2;
      const y = 5.6 - arc * arc * 1.1;
      const z = -0.7 - arc * 0.9;
      const end = new THREE.Vector3(x, y, z);
      const mid = new THREE.Vector3(x * 0.35, 3.4 + (1 - arc) * 0.5, z * 0.3);
      const foliage: BranchLayout["foliage"] = [];
      for (let k = 0; k < 5; k++) {
        const s = i * 10 + k;
        foliage.push({
          pos: new THREE.Vector3(
            end.x + (rand(s) - 0.5) * 2.6,
            end.y + (rand(s + 50) - 0.35) * 1.7,
            end.z + (rand(s + 100) - 0.5) * 2.0
          ),
          scale: 0.8 + rand(s + 150) * 0.8,
          phase: rand(s + 200) * Math.PI * 2,
          tone: k % 3,
        });
      }
      return { branch, end, mid, foliage };
    });
  }, [branches]);
}

// ── Cinematic camera dolly-in (cancelled by first user drag) ──
const CAM_FROM = new THREE.Vector3(0, 8.5, 18);
const CAM_TO = new THREE.Vector3(0, 4.6, 11.5);

function CameraRig() {
  const { camera, controls } = useThree();
  const reduced = usePrefersReducedMotion();
  const intro = useRef({ t: 0, active: !reduced });
  useEffect(() => {
    if (reduced) {
      camera.position.copy(CAM_TO);
      return;
    }
    camera.position.copy(CAM_FROM);
    const ctl = controls as unknown as { addEventListener?: (e: string, f: () => void) => void; removeEventListener?: (e: string, f: () => void) => void } | null;
    const stop = () => {
      intro.current.active = false;
    };
    ctl?.addEventListener?.("start", stop);
    return () => ctl?.removeEventListener?.("start", stop);
  }, [camera, controls]);
  useFrame((_, dt) => {
    if (!intro.current.active) return;
    intro.current.t += dt;
    const k = Math.min(intro.current.t / 2.4, 1);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(CAM_FROM, CAM_TO, e);
    if (k >= 1) intro.current.active = false;
  });
  return null;
}

const FOLIAGE_GREENS = ["#2f7d3b", "#3d9950", "#27662f"];

function Ground() {
  return (
    <group>
      {/* stone podium */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[11.5, 64]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
      </mesh>
      {/* lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[9.6, 64]} />
        <meshStandardMaterial color="#58a55c" roughness={1} />
      </mesh>
      {/* lawn mowing rings */}
      {[3.2, 5.4, 7.6].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[r, r + 0.5, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.07} />
        </mesh>
      ))}
      {/* brass inlay ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[9.6, 9.85, 72]} />
        <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Trunk({ academicYear }: { academicYear: string }) {
  const signTex = useMemo(() => makeSignTexture("Darse Burhani", `Hifz Tree · ${academicYear}`), [academicYear]);
  const barkTex = useMemo(() => makeBarkTexture(), []);
  const barkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: barkTex, bumpMap: barkTex, bumpScale: 0.6, roughness: 1 }),
    [barkTex]
  );
  return (
    <group>
      <mesh position={[0, 1.1, 0]} material={barkMat} castShadow>
        <cylinderGeometry args={[0.62, 0.98, 2.2, 14]} />
      </mesh>
      <mesh position={[0.12, 2.9, 0]} rotation={[0, 0, -0.06]} material={barkMat} castShadow>
        <cylinderGeometry args={[0.42, 0.6, 1.8, 14]} />
      </mesh>
      {[-0.9, -0.45, 0.45, 0.9].map((x, i) => (
        <mesh key={i} position={[x, 0.18, i % 2 === 0 ? 0.25 : -0.25]} rotation={[0, 0, x * 0.5]} material={barkMat} castShadow>
          <cylinderGeometry args={[0.16, 0.3, 1.1, 8]} />
        </mesh>
      ))}
      {/* engraved name board on the trunk */}
      <mesh position={[0, 1.55, 0.8]}>
        <boxGeometry args={[2.9, 1.25, 0.12]} />
        <meshStandardMaterial
          map={signTex}
          emissiveMap={signTex}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={0.12}
          roughness={0.8}
        />
      </mesh>
      {[[-1.28, 1.95], [1.28, 1.95], [-1.28, 1.15], [1.28, 1.15]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.88]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#1f2937" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Branch({ layout, index }: { layout: BranchLayout; index: number }) {
  const reduced = usePrefersReducedMotion();
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 3.5, 0), layout.mid, layout.end]);
    return new THREE.TubeGeometry(curve, 24, Math.max(0.1, 0.15 - index * 0.008), 8, false);
  }, [layout, index]);
  useEffect(() => () => geo.dispose(), [geo]);
  const total = geo.index?.count ?? 0;
  useFrame(({ clock }) => {
    if (reduced) {
      geo.setDrawRange(0, total);
      return;
    }
    const progress = Math.min(Math.max((clock.elapsedTime - 0.25 - index * 0.16) / 0.9, 0), 1);
    geo.setDrawRange(0, Math.floor(progress * total));
  });
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color="#6b4423" roughness={0.95} flatShading />
    </mesh>
  );
}

function Foliage({ layout }: { layout: BranchLayout }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const f = layout.foliage[i];
      if (!f) return;
      m.rotation.y += 0.0012;
      m.position.y = f.pos.y + Math.sin(t * 0.8 + f.phase) * 0.05;
    });
  });
  return (
    <group>
      {layout.foliage.map((f, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          position={f.pos}
          scale={f.scale}
          castShadow
        >
          <icosahedronGeometry args={[0.85, 1]} />
          <meshStandardMaterial color={FOLIAGE_GREENS[f.tone]} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Fruit({
  layout,
  selected,
  onSelect,
}: {
  layout: BranchLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { branch, end } = layout;
  const labelTex = useMemo(
    () =>
      makeLabelTexture([
        { text: `${branch.shortLabel} · ${branch.totalStudents}`, font: "bold 60px Georgia, serif", color: "#0f172a" },
        ...(branch.unassigned > 0
          ? [{ text: `${branch.unassigned} awaiting mentor`, font: "bold 42px Georgia, serif", color: "#b45309" }]
          : []),
      ]),
    [branch]
  );
  useEffect(() => () => labelTex.dispose(), [labelTex]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current && !reduced) group.current.position.y = end.y + Math.sin(t * 1.2 + end.x) * 0.05;
    if (mesh.current) {
      const target = selected ? 1.32 : hovered ? 1.15 : reduced ? 1 : 1 + Math.sin(t * 1.8 + end.x) * 0.04;
      mesh.current.scale.setScalar(reduced ? target : THREE.MathUtils.lerp(mesh.current.scale.x, target, 0.15));
    }
    if (halo.current && !reduced) {
      const mat = halo.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.1 + Math.sin(t * 2 + end.x) * 0.05;
    }
  });
  const setCursor = (e: { nativeEvent: { target: unknown } }, value: string) => {
    const el = e.nativeEvent.target as HTMLElement | null;
    if (el && "style" in el) el.style.cursor = value;
  };
  return (
    <group position={end}>
      <group ref={group}>
        <mesh ref={halo}>
          <sphereGeometry args={[0.52, 16, 16]} />
          <meshBasicMaterial color={branch.colorHex} transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <mesh
          ref={mesh}
        >
          <sphereGeometry args={[0.34, 24, 24]} />
          <meshStandardMaterial
            color={branch.colorHex}
            emissive={branch.colorHex}
            emissiveIntensity={selected ? 1.1 : hovered ? 0.7 : 0.3}
            roughness={0.18}
            metalness={0.1}
          />
        </mesh>
        {/* invisible touch-sized hit target (visual fruit is too small to tap) */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            setCursor(e, "pointer");
          }}
          onPointerOut={(e) => {
            setHovered(false);
            setCursor(e, "auto");
          }}
        >
          <sphereGeometry args={[0.62, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
        {selected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.045, 10, 40]} />
            <meshBasicMaterial color="#b45309" />
          </mesh>
        )}
      </group>
      <sprite position={[0, 1.05, 0]} scale={[2.2, 1.1, 1]}>
        <spriteMaterial map={labelTex} depthTest={false} transparent />
      </sprite>
    </group>
  );
}

export default function MarhalaTree3D({ branches, selected, onSelect, academicYear }: MarhalaTree3DProps) {
  const layout = useTreeLayout(branches);
  const reduced = usePrefersReducedMotion();
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 4.6, 11.5], fov: 45 }}
      gl={{ antialias: true }}
      style={{ background: "transparent" }}
    >
      <color attach="background" args={["#e9f0f6"]} />
      <fog attach="fog" args={["#e9f0f6", 18, 36]} />
      {/* natural daylight */}
      <hemisphereLight args={["#e0f2fe", "#4d7c5f", 0.65]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.7}
        color="#fff7ed"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-6}
      />

      <Ground />
      <Trunk academicYear={academicYear} />
      {layout.map((l, i) => (
        <React.Fragment key={l.branch.marhala}>
          <Branch layout={l} index={i} />
          <Foliage layout={l} />
          <Fruit layout={l} selected={selected === l.branch.marhala} onSelect={() => onSelect(l.branch.marhala)} />
        </React.Fragment>
      ))}

      <CameraRig />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={6}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={0.35}
        autoRotate={!reduced}
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
