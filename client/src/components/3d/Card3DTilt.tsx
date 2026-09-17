import React, { useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Card3DTiltProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glowColor?: string;
  maxTilt?: number;
  depth?: number;
  disabled?: boolean;
}

export function Card3DTilt({
  children,
  className = "",
  onClick,
  glowColor = "#d4af37",
  maxTilt = 12,
  depth = 30,
  disabled = false,
}: Card3DTiltProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [glarePos, setGlarePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Motion values for smooth 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for physics feel
  const springConfig = { damping: 20, stiffness: 220, mass: 0.6 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-maxTilt, maxTilt]), springConfig);
  const translateZ = useSpring(isHovered ? depth : 0, springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      mouseX.set(x);
      mouseY.set(y);

      setGlarePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    },
    [disabled, mouseX, mouseY]
  );

  const handleMouseEnter = () => {
    if (!disabled) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      style={{ perspective: 1000 }}
      className="w-full h-full"
    >
      <motion.div
        ref={cardRef}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: disabled ? 0 : rotateX,
          rotateY: disabled ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        whileTap={!disabled ? { scale: 0.98 } : undefined}
        className={`relative select-none cursor-pointer transition-shadow duration-300 ${className}`}
      >
        {/* Ambient 3D Glow behind card */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-0 transition-opacity duration-500 blur-xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, ${glowColor}40, transparent 75%)`,
            opacity: isHovered ? 0.9 : 0,
            transform: "translateZ(-20px)",
          }}
        />

        {/* Card Content with 3D Preservation */}
        <div
          className="relative w-full h-full rounded-2xl overflow-hidden"
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}

          {/* Dynamic Specular 3D Glare Sheen */}
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300"
            style={{
              opacity: isHovered ? 0.35 : 0,
              background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.7), transparent 60%)`,
              mixBlendMode: "overlay",
              transform: "translateZ(30px)",
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
