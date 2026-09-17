import React from "react";
import { Clock, RefreshCw, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface SessionTimeoutBannerProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
}

export function SessionTimeoutBanner({
  isOpen,
  remainingSeconds,
  onExtend,
}: SessionTimeoutBannerProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-400/40 p-4 animate-slide-in-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-amber-700 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900">Session Expiring Soon</h4>
          <p className="text-xs text-gray-600 mt-0.5">
            Your secure session will expire in <span className="font-mono font-bold text-amber-700">{formatted}</span>.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onExtend}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
              style={{
                background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
              }}
            >
              <RefreshCw className="w-3 h-3" />
              Stay Signed In
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
