"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { LogOut, Settings, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { PageHeader } from "@/components/student/PageHeader";

export default function TalabatSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 3) {
      setMessage({ type: "error", text: "New password must be at least 3 characters." });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setMessage({ type: "error", text: json?.error || "Failed to change password." });
        return;
      }
      setMessage({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <PageHeader icon={Settings} title="Settings" subtitle="Manage your Talabat account" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="fatimi-card mb-6">
          <div className="fatimi-card-header" />
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <Avatar className="w-16 h-16 border-4" style={{ borderColor: "#d4af37" }}>
                  <AvatarFallback className="fatimi-emerald-gradient text-xl text-white font-bold">
                    {user ? getInitials(user.firstName || "", user.lastName || "") : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center fatimi-gold-accent shadow-sm">
                  <span className="text-[10px] text-white font-bold">✓</span>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{user?.firstName} {user?.lastName}</h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <Badge variant="outline" className="mt-1 text-xs bg-emerald-50 text-[#047857] border-emerald-200">Talabat</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name</label><input id="firstName" name="firstName" className="fatimi-input mt-1" value={user?.firstName || ""} readOnly /></div>
              <div><label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name</label><input id="lastName" name="lastName" className="fatimi-input mt-1" value={user?.lastName || ""} readOnly /></div>
            </div>
            <div className="mt-4"><label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label><input id="email" name="email" className="fatimi-input mt-1" value={user?.email || ""} readOnly /></div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="fatimi-card mb-6">
          <div className="fatimi-card-header" />
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                <p className="text-xs text-gray-500">Ensure your account is protected with a secure password.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">Current Password</label>
                <div className="relative mt-1">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="fatimi-input w-full pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                    aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">New Password</label>                  <input
                    id="newPassword"
                    name="newPassword"
                    autoComplete="new-password"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="fatimi-input mt-1 w-full"
                    minLength={3}
                    required
                  />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm New Password</label>                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="fatimi-input mt-1 w-full"
                    minLength={3}
                    required
                  />
              </div>

              {message && (
                <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
                  message.type === "success"
                    ? "text-emerald-800 bg-emerald-50 border border-emerald-200"
                    : "text-red-700 bg-red-50 border border-red-200"
                }`}>
                  {message.type === "success"
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {message.text}
                </div>
              )}

              <Button type="submit" disabled={isSaving} className="fatimi-gold-accent text-white hover:opacity-90">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="fatimi-card">
          <CardContent className="p-6">
            <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
