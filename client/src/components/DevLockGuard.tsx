import React from "react";

interface DevLockGuardProps {
  children: React.ReactNode;
}

export function DevLockGuard({ children }: DevLockGuardProps) {
  return <>{children}</>;
}
