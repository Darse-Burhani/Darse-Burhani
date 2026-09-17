"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { LogOut, KeyRound, Lock, Eye, EyeOff, Loader2, Sparkles, User, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export default function TeacherSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ variant: "warning", title: "Incomplete Form", description: "All password fields are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Mismatch", description: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Weak Password", description: "Password must be at least 8 characters long." });
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      toast({ variant: "destructive", title: "Invalid Password", description: "Password must contain at least 1 letter and 1 number." });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Password Changed", description: "Your teacher account password has been updated." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to change password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to authentication server." });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="fatimi-header-banner relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#034430] via-[#056046] to-[#047857] shadow-xl border border-emerald-500/20 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#d4af37] to-[#996515] shadow-lg border border-amber-300/40">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold mb-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Faculty Account &amp; Security</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Faculty Settings
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">
                Manage your credentials and security configuration.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Profile Overview Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 pb-6 mb-6 border-b border-gray-100">
              <Avatar className="w-16 h-16 rounded-2xl border-2 border-[#047857] ring-2 ring-emerald-100 shadow-md">
                {(user as any)?.avatarUrl || (user as any)?.image ? (
                  <AvatarImage src={(user as any)?.avatarUrl || (user as any)?.image} alt={`${user?.firstName} ${user?.lastName}`} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-[#047857] to-[#064e3b] text-white font-bold text-xl">
                  {getInitials(user?.firstName || "", user?.lastName || "")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold uppercase">
                    {user?.role || "TEACHER"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-gray-600 block mb-1">First Name</span>
                <input
                  type="text"
                  value={user?.firstName || ""}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-none"
                />
              </div>
              <div>
                <span className="font-semibold text-gray-600 block mb-1">Last Name</span>
                <input
                  type="text"
                  value={user?.lastName || ""}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold text-gray-600 block mb-1">Official Email Address</span>
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 outline-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="rounded-3xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-base">Change Password</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update your faculty portal password (min. 8 characters with letters &amp; numbers).
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-xs text-gray-500 hover:text-gray-800 gap-1.5 h-8"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPasswords ? "Hide" : "Reveal"}
              </Button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="tCurPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Current Password *
                  </label>
                  <input
                    id="tCurPass"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="tNewPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    New Password *
                  </label>
                  <input
                    id="tNewPass"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min. 8)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label htmlFor="tConfPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Confirm New Password *
                  </label>
                  <input
                    id="tConfPass"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md gap-1.5"
                >
                  {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sign Out Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="rounded-3xl border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Session &amp; Security</p>
              <p className="text-xs text-gray-500 mt-0.5">End your active portal session securely</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-xl font-semibold gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
