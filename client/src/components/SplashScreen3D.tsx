"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface SplashScreen3DProps {
  className?: string;
}

export function SplashScreen3D({ className = "" }: SplashScreen3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // Fallback if WebGL is unavailable
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xfffaed, 1.4);
    scene.add(ambientLight);

    const goldPointLight = new THREE.PointLight(0xf59e0b, 4.2, 25);
    goldPointLight.position.set(4, 5, 5);
    scene.add(goldPointLight);

    const bronzePointLight = new THREE.PointLight(0xc59b27, 3.5, 25);
    bronzePointLight.position.set(-4, -3, -4);
    scene.add(bronzePointLight);

    const warmAmbientAccent = new THREE.PointLight(0xfcd468, 2.0, 20);
    warmAmbientAccent.position.set(0, 4, -3);
    scene.add(warmAmbientAccent);

    // Root Group for 3D Motion & Parallax
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.18,
      emissive: 0x78350f,
      emissiveIntensity: 0.25,
    });

    const antiqueGoldMat = new THREE.MeshStandardMaterial({
      color: 0xc59b27,
      metalness: 0.88,
      roughness: 0.20,
      emissive: 0x5a4300,
      emissiveIntensity: 0.3,
    });

    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x451a03,
      emissiveIntensity: 0.2,
    });

    // 1. Armillary Spheres (3 Concentric 3D Gyroscope Rings)
    const ring1Geo = new THREE.TorusGeometry(2.35, 0.038, 24, 120);
    const ring1 = new THREE.Mesh(ring1Geo, goldMat);
    masterGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(1.95, 0.032, 24, 120);
    const ring2 = new THREE.Mesh(ring2Geo, antiqueGoldMat);
    ring2.rotation.x = Math.PI / 3;
    masterGroup.add(ring2);

    const ring3Geo = new THREE.TorusGeometry(1.55, 0.028, 24, 120);
    const ring3 = new THREE.Mesh(ring3Geo, amberMat);
    ring3.rotation.y = Math.PI / 4;
    masterGroup.add(ring3);

    // 2. Central 3D Sacred Polyhedron (Gilded Icosahedron Crystal + Wireframe)
    const crystalGroup = new THREE.Group();
    masterGroup.add(crystalGroup);

    const crystalGeo = new THREE.IcosahedronGeometry(0.85, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      metalness: 0.88,
      roughness: 0.15,
      emissive: 0x92400e,
      emissiveIntensity: 0.45,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalGroup.add(crystalMesh);

    const wireframeGeo = new THREE.IcosahedronGeometry(0.865, 0);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeo, wireframeMat);
    crystalGroup.add(wireframeMesh);

    // 3. Orbital Particles / Stardust Constellation
    const particleCount = 380;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Golden sphere coordinates
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.8 + Math.random() * 2.5;

      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
      particleScales[i] = Math.random() * 0.8 + 0.4;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.055,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particlePoints);

    // Mouse / Touch Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const halfX = window.innerWidth / 2;
      const halfY = window.innerHeight / 2;
      mouseX = (e.clientX - halfX) / halfX;
      mouseY = (e.clientY - halfY) / halfY;
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth Parallax Lerp
      targetX += (mouseX * 0.35 - targetX) * 0.05;
      targetY += (mouseY * 0.35 - targetY) * 0.05;
      masterGroup.rotation.y = targetX;
      masterGroup.rotation.x = -targetY;

      // 3D Motion Graphics Rotation
      ring1.rotation.x = elapsedTime * 0.45;
      ring1.rotation.y = elapsedTime * 0.3;

      ring2.rotation.y = -elapsedTime * 0.55;
      ring2.rotation.z = elapsedTime * 0.35;

      ring3.rotation.x = -elapsedTime * 0.4;
      ring3.rotation.z = -elapsedTime * 0.6;

      // Crystal floating levitation & spin
      crystalGroup.rotation.y = elapsedTime * 0.65;
      crystalGroup.rotation.x = Math.sin(elapsedTime * 0.8) * 0.25;
      crystalGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.08;

      // Particle Constellation Gentle Spin
      particlePoints.rotation.y = elapsedTime * 0.08;
      particlePoints.rotation.x = Math.sin(elapsedTime * 0.05) * 0.1;

      // Render 3D Scene
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("resize", handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js objects
      ring1Geo.dispose();
      ring2Geo.dispose();
      ring3Geo.dispose();
      crystalGeo.dispose();
      wireframeGeo.dispose();
      particleGeo.dispose();

      goldMat.dispose();
      antiqueGoldMat.dispose();
      amberMat.dispose();
      crystalMat.dispose();
      wireframeMat.dispose();
      particleMat.dispose();

      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`absolute inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{ touchAction: "none" }}
    />
  );
}
