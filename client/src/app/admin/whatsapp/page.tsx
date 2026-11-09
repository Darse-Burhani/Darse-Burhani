"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Smartphone,
  ShieldCheck,
  Cloud,
  Loader2,
  Clock,
  PenLine,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface WhatsAppStatus {
  isConnected: boolean;
  status: "CONNECTED" | "CONNECTING" | "DISCONNECTED";
  phone: string | null;
  name: string | null;
  qrCode: string | null;
  qrDataUrl: string | null;
  error: string | null;
}

export default function AdminWhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile Rename State
  const [customName, setCustomName] = useState("");
  const [updatingName, setUpdatingName] = useState(false);

  // ── Fetch Status ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/status");
      const data = await res.json();
      if (data.success && data.data) {
        setStatus(data.data);
      }
    } catch {
      // Ignore poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll status every 4 seconds when disconnected (to automatically pick up QR scan)
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ── Reconnect / Refresh QR ──
  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/reconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Connecting", description: "WhatsApp connection cycle initialized", variant: "default" });
        fetchStatus();
      } else {
        toast({ title: "Notice", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to reconnect", variant: "destructive" });
    } finally {
      setReconnecting(false);
    }
  };

  // ── Logout / Unlink ──
  const handleLogout = async () => {
    if (!confirm("Are you sure you want to unlink this WhatsApp session? You will need to scan the QR code again.")) {
      return;
    }

    setLoggingOut(true);
    try {
      const res = await fetch("/api/admin/whatsapp/logout", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Unlinked", description: "Session unlinked. You can now scan a new QR code.", variant: "default" });
        fetchStatus();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to unlink", variant: "destructive" });
    } finally {
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    if (status?.name && !customName) {
      setCustomName(status.name);
    }
  }, [status?.name]);

  // ── Update Profile Display Name ──
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast({ title: "Name Required", description: "Please enter a valid display name", variant: "destructive" });
      return;
    }

    setUpdatingName(true);
    try {
      const res = await fetch("/api/admin/whatsapp/profile-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "✓ WhatsApp Name Updated",
          description: data.message || "Display name updated successfully",
          variant: "success",
        });
        fetchStatus();
      } else {
        toast({ title: "Update Failed", description: data.error || "Failed to update name", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update profile name", variant: "destructive" });
    } finally {
      setUpdatingName(false);
    }
  };

  const isConnected = status?.isConnected ?? false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Header Banner ── */}
      <div className="fatimi-header-banner">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md shrink-0">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  24/7 Cloud WhatsApp Gateway
                </h1>
                {isConnected ? (
                  <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-300/40 text-[11px] font-bold px-3 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Connected 24/7
                  </span>
                ) : (
                  <span className="bg-amber-400/20 text-amber-200 border border-amber-300/30 text-[11px] font-bold px-3 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    1-Time Scan Required
                  </span>
                )}
              </div>
              <p className="text-emerald-100 text-sm font-medium mt-0.5">
                Self-Hosted &amp; 100% Free &middot; Automatic Cloud Dispatch for Leaves, Badal Duties &amp; Maktabat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={reconnecting}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl text-xs font-bold backdrop-blur-md"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", reconnecting && "animate-spin")} />
              Sync Status
            </Button>
            {isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-300/30 rounded-xl text-xs font-bold backdrop-blur-md"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Unlink Device
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Status Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="fatimi-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isConnected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
              {isConnected ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <Clock className="w-5 h-5 text-amber-700" />}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Gateway State</p>
              <p className="text-sm font-extrabold text-slate-900">
                {isConnected ? "Active & Sending 24/7" : "Awaiting QR Link"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="fatimi-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Linked Phone</p>
              <p className="text-sm font-extrabold text-slate-900 font-mono">
                {status?.phone ? `+${status.phone}` : "Not linked yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="fatimi-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cloud Persistence</p>
              <p className="text-sm font-extrabold text-slate-900">
                PostgreSQL Saved Creds
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Connection & Setup Card ── */}
      {isConnected ? (
        <Card className="fatimi-card border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-9 h-9 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    WhatsApp Cloud Gateway is Live &amp; Connected!
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    Your session is permanently stored in the database. Notifications for parent leaves, faculty badal duty, and library receipts will dispatch automatically 24/7 without needing your PC or browser to be open.
                  </p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-lg border border-slate-200 text-emerald-900">
                      Linked: +{status?.phone || "918955199220"}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Multi-Device Persistent
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-xs rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 font-bold shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Unlink &amp; Change Number
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* QR Code Card */}
          <div className="lg:col-span-5">
            <Card className="fatimi-card border-2 border-amber-400/40 text-center">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-700" />
                  <span>Scan QR Code (1-Time Only)</span>
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Scan this code with your WhatsApp to link permanently
                </p>
              </CardHeader>

              <CardContent className="p-6 flex flex-col items-center justify-center space-y-4">
                {status?.qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/40 shadow-md">
                    <img
                      src={status.qrDataUrl}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64 object-contain rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <p className="text-xs font-medium">Generating WhatsApp QR code...</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReconnect}
                    disabled={reconnecting}
                    className="text-xs rounded-xl font-bold border-slate-200"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-emerald-700", reconnecting && "animate-spin")} />
                    Refresh QR Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3-Step Guide */}
          <div className="lg:col-span-7">
            <Card className="fatimi-card h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-700" />
                  <span>How to Link Your Device (Takes 10 Seconds)</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 text-xs text-slate-600">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white font-extrabold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Open WhatsApp on your Phone</p>
                    <p className="text-slate-600 mt-0.5">
                      Open WhatsApp on the official administration or hotline phone (e.g. +91 8955199220).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white font-extrabold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Go to Linked Devices</p>
                    <p className="text-slate-600 mt-0.5">
                      On <strong>Android</strong>: Tap the 3 dots in the top right &rarr; <strong>Linked devices</strong>.
                      <br />
                      On <strong>iPhone</strong>: Go to <strong>Settings</strong> &rarr; <strong>Linked Devices</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white font-extrabold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Tap &quot;Link a Device&quot; &amp; Scan</p>
                    <p className="text-slate-600 mt-0.5">
                      Point your phone&apos;s camera at the QR code on the left. Once scanned, the screen will automatically turn green and remain connected forever.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    <strong>Permanent Link:</strong> Your credentials are saved to PostgreSQL. You do not need to keep this page open or keep your computer turned on.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── WhatsApp Sender Identity / Display Name Card ── */}
      <Card className="fatimi-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <PenLine className="w-5 h-5 text-emerald-700" />
            <span>WhatsApp Sender Identity &amp; Display Name</span>
          </CardTitle>
          <p className="text-xs text-slate-500">
            Set the official institutional name that recipients and parents see when receiving notifications
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-8">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WhatsApp Profile Display Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Idarah Darse Burhani or Darse Burhani Administration"
                    disabled={!isConnected}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Current Name: <strong className="text-emerald-800">{status?.name || "Darse Burhani Administration"}</strong>. <em>You can also change this directly on your phone in WhatsApp &rarr; Settings &rarr; Profile.</em>
                </p>
              </div>

              <div className="md:col-span-4 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={updatingName || !isConnected || !customName.trim()}
                  className="w-full sm:w-auto bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs h-9 px-5 rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {updatingName ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                      Save Display Name
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

