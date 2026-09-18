import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { Shield, Lock, Unlock, KeyRound, LogOut, Sparkles, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface InactivityLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  idleMinutes: number;
}

export function InactivityLockModal({ isOpen, onUnlock, idleMinutes }: InactivityLockModalProps) {
  const { data: session } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !session?.user) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your password to unlock");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: session.user.email, password }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setPassword("");
        setError(null);
        onUnlock();
      } else {
        setError(json.error || "Incorrect password. Please try again.");
      }
    } catch {
      setError("Could not verify credentials. Check your network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl animate-fade-in">
      {/* Ambient Fatimi Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white/95 rounded-3xl shadow-2xl border border-amber-400/40 p-8 overflow-hidden backdrop-blur-md">
        {/* Authentic Gold Top Hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: "linear-gradient(90deg, #064e3b, #d4af37, #064e3b)",
          }}
        />

        {/* Security Shield Icon Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 flex items-center justify-center shadow-lg border border-amber-400/30 mb-4">
            <Shield className="w-7 h-7 text-amber-300" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Session Locked
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Lock className="w-3 h-3 mr-1 text-emerald-700" />
              Protected
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Inactive for {idleMinutes} minutes. Verify your password to continue without losing your work.
          </p>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 mb-6">
          <Avatar className="w-12 h-12 ring-2 ring-amber-400/50 shadow-sm">
            {session.user.avatarUrl && <AvatarImage src={session.user.avatarUrl} />}
            <AvatarFallback className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white font-semibold">
              {getInitials(session.user.firstName, session.user.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">
              {session.user.firstName} {session.user.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
            {session.user.role}
          </span>
        </div>

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label htmlFor="lock-password" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              Account Password
            </label>
            <input
              id="lock-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password to unlock..."
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-inner bg-gray-50/50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #b8860b 100%)",
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Unlock className="w-4 h-4 text-amber-300" />
                Unlock Screen
              </>
            )}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Darse Burhani SIS
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
