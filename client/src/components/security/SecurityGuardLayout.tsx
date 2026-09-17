import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { InactivityLockModal } from "./InactivityLockModal";
import { SessionTimeoutBanner } from "./SessionTimeoutBanner";

interface SecurityContextType {
  isLocked: boolean;
  lockNow: () => void;
  unlock: () => void;
  idleMinutes: number;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: false,
  lockNow: () => {},
  unlock: () => {},
  idleMinutes: 15,
});

export const useSecurity = () => useContext(SecurityContext);

interface SecurityGuardLayoutProps {
  children: React.ReactNode;
  /** Idle timeout in minutes before locking the screen (default: 15) */
  idleTimeoutMinutes?: number;
}

export function SecurityGuardLayout({
  children,
  idleTimeoutMinutes = 15,
}: SecurityGuardLayoutProps) {
  const { data: session, status, update } = useSession();
  const [isLocked, setIsLocked] = useState(false);
  const [showTimeoutBanner, setShowTimeoutBanner] = useState(false);
  const [timeoutRemaining, setTimeoutRemaining] = useState(120); // 2 minutes

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Track user activity
  useEffect(() => {
    if (status !== "authenticated" || !session) return;

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"];
    const handleActivity = () => {
      if (!isLocked) {
        resetActivity();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    // Inactivity ticker (checks every 10 seconds)
    timerRef.current = setInterval(() => {
      if (isLocked) return;

      const idleMs = Date.now() - lastActivityRef.current;
      const thresholdMs = idleTimeoutMinutes * 60 * 1000;

      if (idleMs >= thresholdMs) {
        setIsLocked(true);
      }
    }, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, session, isLocked, idleTimeoutMinutes, resetActivity]);

  const lockNow = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    resetActivity();
  }, [resetActivity]);

  const handleExtendSession = async () => {
    try {
      await update();
      setShowTimeoutBanner(false);
      resetActivity();
    } catch (err) {
      console.error("Failed to extend session:", err);
    }
  };

  return (
    <SecurityContext.Provider value={{ isLocked, lockNow, unlock, idleMinutes: idleTimeoutMinutes }}>
      <div className={isLocked ? "select-none filter blur-sm transition-all duration-300" : "transition-all duration-300"}>
        {children}
      </div>

      <InactivityLockModal
        isOpen={isLocked && status === "authenticated"}
        onUnlock={unlock}
        idleMinutes={idleTimeoutMinutes}
      />

      <SessionTimeoutBanner
        isOpen={showTimeoutBanner}
        remainingSeconds={timeoutRemaining}
        onExtend={handleExtendSession}
      />
    </SecurityContext.Provider>
  );
}
