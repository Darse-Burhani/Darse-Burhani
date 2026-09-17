"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toast";
import { FatimiThemeProvider } from "@/context/FatimiThemeContext";
import { PortalAccessProvider } from "@/context/PortalAccessContext";
import { SecurityGuardLayout } from "@/components/security/SecurityGuardLayout";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FatimiThemeProvider>
        <PortalAccessProvider>
          <SecurityGuardLayout idleTimeoutMinutes={15}>
            {children}
            <Toaster />
          </SecurityGuardLayout>
        </PortalAccessProvider>
      </FatimiThemeProvider>
    </SessionProvider>
  );
}
