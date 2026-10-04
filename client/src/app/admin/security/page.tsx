"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Key,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Laptop,
  Smartphone,
  Sliders,
  RefreshCw,
  Search,
  Save,
  LogOut,
  Fingerprint,
  Eye,
  Server,
  Flame,
  Globe,
  Ban,
  Radio,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSecurity } from "@/components/security/SecurityGuardLayout";
import { cn } from "@/lib/utils";

interface BlockedAttackEvent {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  category: string;
  rule: string;
  matchedValue: string;
  userAgent?: string;
  threatScore: number;
}

interface BannedIpInfo {
  ip: string;
  bannedAt: number;
  expiresAt: number;
  reason: string;
  threatScore: number;
  totalViolations: number;
}

interface WafStats {
  totalRequestsChecked: number;
  totalAttacksBlocked: number;
  blockedByCategory: Record<string, number>;
  activeBannedIpsCount: number;
  recentAttacks: BlockedAttackEvent[];
}

interface SecurityOverviewData {
  securityScore: number;
  totalUsers: number;
  activeUsers: number;
  biometricDevices: number;
  failedLogins24h: number;
  criticalAlertsCount: number;
  bannedIpsCount?: number;
  wafStats?: WafStats;
  policies: {
    sessionTimeoutMinutes: number;
    inactivityLockMinutes: number;
    maxFailedLoginsBeforeLockout: number;
    lockoutDurationMinutes: number;
    requireStrongPassword: boolean;
    twoFactorEnforced: boolean;
    ipWhitelistEnabled: boolean;
    ipWhitelist: string[];
  };
  recentThreats: Array<{
    id: string;
    timestamp: string;
    action: string;
    userEmail?: string;
    severity: "INFO" | "WARN" | "CRITICAL";
    status: "SUCCESS" | "FAILED" | "BLOCKED";
    ipAddress: string;
  }>;
  systemStatus: {
    firewall: string;
    wafShield?: string;
    rateLimiter: string;
    cspPolicy: string;
    jwtEncryption: string;
    databaseSSL: string;
  };
}

interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  category: "AUTH" | "ACCESS" | "DATA" | "ADMIN" | "POLICY" | "SECURITY";
  severity: "INFO" | "WARN" | "CRITICAL";
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown> | string;
}

interface ActiveSession {
  id: string;
  sessionToken: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string | null;
  };
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  isCurrent?: boolean;
  deviceType?: string;
}

interface RbacModule {
  module: string;
  description: string;
  permissions: Array<{
    name: string;
    admin: boolean;
    teacher: boolean;
    student: boolean;
    parent: boolean;
  }>;
}

export default function AdminSecurityPage() {
  const { toast } = useToast();
  const { lockNow } = useSecurity();
  const [activeTab, setActiveTab] = useState<
    "overview" | "waf-shield" | "audit-logs" | "sessions" | "rbac" | "policies"
  >("overview");

  // State
  const [overview, setOverview] = useState<SecurityOverviewData | null>(null);
  const [wafStats, setWafStats] = useState<WafStats | null>(null);
  const [bannedIps, setBannedIps] = useState<BannedIpInfo[]>([]);
  const [whitelistedIps, setWhitelistedIps] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [rbacModules, setRbacModules] = useState<RbacModule[]>([]);
  const [policies, setPolicies] = useState<SecurityOverviewData["policies"] | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [wafActionLoading, setWafActionLoading] = useState(false);

  // Manual Ban & Whitelist Form State
  const [banInputIp, setBanInputIp] = useState("");
  const [banInputReason, setBanInputReason] = useState("");
  const [banInputMinutes, setBanInputMinutes] = useState(60);
  const [whitelistInputIp, setWhitelistInputIp] = useState("");

  // Filters for audit logs
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [overviewRes, wafRes, bannedRes, whitelistRes, logsRes, sessionsRes, rbacRes, policiesRes] =
        await Promise.all([
          fetch("/api/admin/security/overview").then((r) => r.json()),
          fetch("/api/admin/security/waf-stats").then((r) => r.json()),
          fetch("/api/admin/security/banned-ips").then((r) => r.json()),
          fetch("/api/admin/security/whitelisted-ips").then((r) => r.json()),
          fetch("/api/admin/security/audit-logs").then((r) => r.json()),
          fetch("/api/admin/security/sessions").then((r) => r.json()),
          fetch("/api/admin/security/rbac-matrix").then((r) => r.json()),
          fetch("/api/admin/security/policies").then((r) => r.json()),
        ]);

      if (overviewRes.success) setOverview(overviewRes.data);
      if (wafRes.success) setWafStats(wafRes.data);
      if (bannedRes.success) setBannedIps(bannedRes.data);
      if (whitelistRes.success) setWhitelistedIps(whitelistRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data);
      if (sessionsRes.success) setSessions(sessionsRes.data);
      if (rbacRes.success) setRbacModules(rbacRes.data);
      if (policiesRes.success) setPolicies(policiesRes.data);
    } catch (err) {
      console.error("Failed to load security data:", err);
      toast({
        title: "Network Notice",
        description: "Loading live security metrics...",
        variant: "default",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/admin/security/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Session Terminated", description: "The session has been revoked." });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        toast({ title: "Error", description: json.error || "Could not revoke session", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed", variant: "destructive" });
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policies) return;
    setSavingPolicies(true);
    try {
      const res = await fetch("/api/admin/security/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policies),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Policies Updated", description: "System security policies saved successfully." });
        setPolicies(json.data);
      } else {
        toast({ title: "Error", description: json.error || "Failed to update policies", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to connect to security service", variant: "destructive" });
    } finally {
      setSavingPolicies(false);
    }
  };

  const handleUnbanIp = async (ip: string) => {
    try {
      setWafActionLoading(true);
      const res = await fetch("/api/admin/security/banned-ips/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "IP Unbanned", description: `IP ${ip} has been unblocked.` });
        setBannedIps((prev) => prev.filter((b) => b.ip !== ip));
      } else {
        toast({ title: "Error", description: json.error || "Failed to unban IP", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setWafActionLoading(false);
    }
  };

  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banInputIp.trim()) return;
    try {
      setWafActionLoading(true);
      const res = await fetch("/api/admin/security/banned-ips/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: banInputIp.trim(),
          reason: banInputReason.trim() || "Manual admin block",
          durationMinutes: Number(banInputMinutes) || 60,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "IP Blocked", description: `IP ${banInputIp} has been banned.` });
        setBanInputIp("");
        setBanInputReason("");
        loadData();
      } else {
        toast({ title: "Error", description: json.error || "Failed to ban IP", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setWafActionLoading(false);
    }
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whitelistInputIp.trim()) return;
    try {
      setWafActionLoading(true);
      const res = await fetch("/api/admin/security/whitelisted-ips/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: whitelistInputIp.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "IP Whitelisted", description: `IP ${whitelistInputIp} is now permanently trusted.` });
        setWhitelistInputIp("");
        loadData();
      } else {
        toast({ title: "Error", description: json.error || "Failed to whitelist IP", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setWafActionLoading(false);
    }
  };

  const handleRemoveWhitelist = async (ip: string) => {
    try {
      setWafActionLoading(true);
      const res = await fetch("/api/admin/security/whitelisted-ips/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Removed from Whitelist", description: `IP ${ip} removed from trusted whitelist.` });
        setWhitelistedIps((prev) => prev.filter((item) => item !== ip));
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setWafActionLoading(false);
    }
  };

  const handleResetRateLimits = async () => {
    if (!confirm("Are you sure you want to clear all rate limit counters and temporary lockout buckets?")) {
      return;
    }
    try {
      setWafActionLoading(true);
      const res = await fetch("/api/admin/security/rate-limits/reset", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Rate Limits Cleared", description: "All client throttling limits have been reset." });
        loadData();
      }
    } catch {
      toast({ title: "Error", description: "Failed to reset rate limits", variant: "destructive" });
    } finally {
      setWafActionLoading(false);
    }
  };

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        !searchQuery ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.userName && log.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        log.ipAddress.includes(searchQuery);

      const matchesSeverity = severityFilter === "ALL" || log.severity === severityFilter;
      const matchesCategory = categoryFilter === "ALL" || log.category === categoryFilter;

      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [auditLogs, searchQuery, severityFilter, categoryFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 flex items-center justify-center shadow-md border border-amber-400/30">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Security Wall & Access Command
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Active WAF defense, anti-hacking shield, RBAC matrix, and audit telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={lockNow}
            className="rounded-xl border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100 flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            Lock View Now
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={refreshing}
            className="rounded-xl border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-gray-600", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Top Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-gray-100/80 border border-gray-200 backdrop-blur-sm">
        {[
          { id: "overview", label: "Security Posture", icon: Activity },
          {
            id: "waf-shield",
            label: "WAF & Security Wall",
            icon: ShieldAlert,
            count: bannedIps.length > 0 ? bannedIps.length : undefined,
          },
          { id: "audit-logs", label: "Audit Telemetry", icon: Eye, count: auditLogs.length },
          { id: "sessions", label: "Active Sessions", icon: Laptop, count: sessions.length },
          { id: "rbac", label: "RBAC Matrix", icon: Users },
          { id: "policies", label: "Access Policies", icon: Sliders },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-white text-emerald-950 shadow-sm border border-emerald-900/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", isActive ? "text-amber-600" : "text-gray-400")} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    isActive ? "bg-emerald-100 text-emerald-900" : "bg-gray-200 text-gray-700"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & HEALTH ── */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                    Defense Hardening
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-display text-emerald-950">
                    {overview?.securityScore ?? 99}%
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">Enterprise Grade</span>
                </div>
                <div className="w-full bg-emerald-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-600 to-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${overview?.securityScore ?? 99}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    WAF Attacks Blocked
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-rose-600" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-display text-gray-900">
                    {wafStats?.totalAttacksBlocked ?? 0}
                  </span>
                  <span className="text-xs text-rose-600 font-semibold">Threats Neutralized</span>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deep payload inspection active
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Banned Malicious IPs
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Ban className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-display text-gray-900">
                    {bannedIps.length}
                  </span>
                  <span className="text-xs text-gray-500">Auto & Manual Locks</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Threat score threshold: 100 pts</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Active Sessions
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Laptop className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-display text-gray-900">
                    {sessions.length || 1}
                  </span>
                  <span className="text-xs text-gray-500">Live Connections</span>
                </div>
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> JWT signature + SameSite cookie
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Defense Layers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-700" />
                  Active Web Security Wall Layers
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time security headers, deep payload filtering, and firewall rules active on this server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    name: "Web Application Firewall (WAF) Engine",
                    desc: "Deep packet inspection for SQLi, XSS, RCE, LFI, and Scanner Bots",
                    status: "SHIELD ACTIVE",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "HTTP Armor Headers (OWASP Standards)",
                    desc: "CSP, X-Frame-Options, X-Content-Type-Options, COOP, CORP, Referrer-Policy",
                    status: "ENFORCED",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "Cross-Site Request Forgery (CSRF) Guard",
                    desc: "Strict Origin and Referer validation on all state-modifying requests",
                    status: "ACTIVE",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "Sliding-Window Rate Limiter & Lockout",
                    desc: "Defends against brute-force login attacks, password guessing & API spam",
                    status: "ONLINE",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "Dynamic Threat Scoring & Auto-Ban",
                    desc: "Automatically isolates and bans attacker IPs exceeding threat threshold",
                    status: "ARMED",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "HttpOnly SameSite Session Cookies",
                    desc: "Prevents client-side script token theft and credential exfiltration",
                    status: "ENFORCED",
                    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  },
                  {
                    name: "Inactivity Screen-Lock Sentinel",
                    desc: "Blurs view and locks console after 15m idle period",
                    status: "ARMED",
                    color: "text-amber-700 bg-amber-50 border-amber-200",
                  },
                ].map((layer, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{layer.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{layer.desc}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] font-mono uppercase tracking-wide", layer.color)}>
                      {layer.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Threat Feed */}
            <Card className="border-gray-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Recent Security Events
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest intercepted attempts and policy alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview?.recentThreats && overview.recentThreats.length > 0 ? (
                  overview.recentThreats.map((threat) => (
                    <div
                      key={threat.id}
                      className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{threat.action}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-mono",
                            threat.severity === "CRITICAL"
                              ? "text-rose-700 bg-rose-50 border-rose-200"
                              : threat.severity === "WARN"
                              ? "text-amber-700 bg-amber-50 border-amber-200"
                              : "text-blue-700 bg-blue-50 border-blue-200"
                          )}
                        >
                          {threat.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-gray-500 text-[11px]">
                        <span>IP: {threat.ipAddress}</span>
                        <span>{new Date(threat.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-gray-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    No recent security incidents. System operating normally.
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("waf-shield")}
                  className="w-full mt-2 text-xs text-emerald-900 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100"
                >
                  Open WAF & Threat Wall →
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: WAF & SECURITY WALL ── */}
      {activeTab === "waf-shield" && (
        <div className="space-y-6 animate-fade-in">
          {/* Defense Modules Overview Banner */}
          <Card className="border-emerald-900/20 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      FIREWALL ACTIVE & ENFORCING
                    </span>
                    <span className="text-xs text-emerald-200/70 font-mono">
                      Inspection Engine: v2.4 Enterprise
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-amber-200 font-display">
                    Next-Gen Web Application Security Wall
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
                    Every incoming HTTP request, query parameter, header, and JSON payload is inspected in real-time
                    for SQL injection, XSS cross-site scripting, remote code execution, directory traversal, and
                    malicious automated scanners.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    onClick={handleResetRateLimits}
                    disabled={wafActionLoading}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", wafActionLoading && "animate-spin")} />
                    Reset Rate Limits & Locks
                  </Button>
                </div>
              </div>

              {/* Core Shield Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-emerald-800/60">
                {[
                  { title: "SQLi Shield", desc: "Union, stacked & time injection", state: "Active" },
                  { title: "XSS Filter", desc: "Script tags, DOM handlers, URIs", state: "Active" },
                  { title: "RCE Armor", desc: "Shell chaining & subshells", state: "Active" },
                  { title: "LFI Guard", desc: "Path traversal & config probe", state: "Active" },
                  { title: "Bot Hunter", desc: "Vulnerability scanners blocked", state: "Active" },
                  { title: "CSRF Guard", desc: "Origin & Referer verified", state: "Active" },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-xs font-bold text-amber-300">{item.title}</p>
                    <p className="text-[10px] text-emerald-200/60 mt-0.5 line-clamp-1">{item.desc}</p>
                    <Badge className="mt-2 text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                      {item.state}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Attack Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                title: "SQL Injections",
                count: wafStats?.blockedByCategory?.SQL_INJECTION ?? 0,
                color: "text-rose-600",
                bg: "bg-rose-50",
              },
              {
                title: "XSS Attacks",
                count: wafStats?.blockedByCategory?.XSS_ATTACK ?? 0,
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                title: "Command Injections",
                count: wafStats?.blockedByCategory?.COMMAND_INJECTION ?? 0,
                color: "text-purple-600",
                bg: "bg-purple-50",
              },
              {
                title: "Path Traversals",
                count: wafStats?.blockedByCategory?.PATH_TRAVERSAL ?? 0,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                title: "Malicious Bots",
                count: wafStats?.blockedByCategory?.MALICIOUS_BOT ?? 0,
                color: "text-red-600",
                bg: "bg-red-50",
              },
            ].map((stat, i) => (
              <Card key={i} className="border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase">{stat.title}</p>
                  <p className={cn("text-2xl font-bold font-display mt-2", stat.color)}>{stat.count}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Blocked & Logged</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Banned IP Management and Manual Ban Tool */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Banned IPs Table */}
            <Card className="lg:col-span-2 border-gray-200">
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Ban className="w-4 h-4 text-rose-600" />
                      Blocked & Banned IP Addresses
                    </CardTitle>
                    <CardDescription className="text-xs">
                      IPs automatically quarantined by the threat engine or manually blacklisted by administrators
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 font-mono text-xs">
                    {bannedIps.length} Active Ban{bannedIps.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4">IP Address</th>
                        <th className="py-2.5 px-4">Reason / Violation</th>
                        <th className="py-2.5 px-4">Threat Score</th>
                        <th className="py-2.5 px-4">Expires</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bannedIps.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">
                            No IP addresses are currently banned. The perimeter is clean.
                          </td>
                        </tr>
                      ) : (
                        bannedIps.map((b) => (
                          <tr key={b.ip} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-900">{b.ip}</td>
                            <td className="py-3 px-4 max-w-xs text-gray-600 truncate" title={b.reason}>
                              {b.reason}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 text-[10px] font-mono">
                                {b.threatScore} pts
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                              {b.expiresAt === Infinity ? "Permanent" : new Date(b.expiresAt).toLocaleTimeString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnbanIp(b.ip)}
                                disabled={wafActionLoading}
                                className="text-xs h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              >
                                Unban
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Manual IP Ban & Whitelist Form */}
            <div className="space-y-6">
              <Card className="border-gray-200">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-amber-600" />
                    Manual IP Quarantine
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Instantly block any malicious or suspicious IP address
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleManualBan} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Target IP Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 198.51.100.45"
                        value={banInputIp}
                        onChange={(e) => setBanInputIp(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Reason for Ban</label>
                      <input
                        type="text"
                        placeholder="e.g. Repeated brute force probe"
                        value={banInputReason}
                        onChange={(e) => setBanInputReason(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Duration (Minutes, 0 = Permanent)</label>
                      <input
                        type="number"
                        min={0}
                        value={banInputMinutes}
                        onChange={(e) => setBanInputMinutes(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={wafActionLoading || !banInputIp.trim()}
                      className="w-full text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white"
                    >
                      Enforce IP Ban
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Whitelist Card */}
              <Card className="border-gray-200">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    Trusted IP Whitelist
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {whitelistedIps.map((ip) => (
                      <Badge key={ip} variant="outline" className="font-mono text-[10px] bg-gray-50 flex items-center gap-1">
                        {ip}
                        {ip !== "127.0.0.1" && ip !== "::1" && (
                          <button
                            onClick={() => handleRemoveWhitelist(ip)}
                            className="text-gray-400 hover:text-rose-600 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>

                  <form onSubmit={handleAddWhitelist} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add IP to whitelist"
                      value={whitelistInputIp}
                      onChange={(e) => setWhitelistInputIp(e.target.value)}
                      className="flex-1 px-3 py-1 rounded-lg border border-gray-200 text-xs font-mono"
                    />
                    <Button type="submit" size="sm" variant="outline" className="text-xs">
                      Add
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Live Blocked Attack Stream */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-600" />
                    Live Blocked Attack Stream & Payloads
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time intercept log of malicious requests rejected at the application perimeter
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 font-mono text-xs">
                  {wafStats?.recentAttacks?.length ?? 0} Recorded In Memory
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Attacker IP</th>
                      <th className="py-2.5 px-4">Method & URL</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Triggered Rule</th>
                      <th className="py-2.5 px-4">Matched Payload Sample</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!wafStats?.recentAttacks || wafStats.recentAttacks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                          No malicious payloads detected yet. The Security Wall is scanning all incoming traffic.
                        </td>
                      </tr>
                    ) : (
                      wafStats.recentAttacks.map((atk) => (
                        <tr key={atk.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-gray-500 whitespace-nowrap">
                            {new Date(atk.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-gray-900">{atk.ip}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-gray-700 mr-1">{atk.method}</span>
                            <span className="text-gray-500 font-mono text-[11px] truncate max-w-xs inline-block align-bottom">
                              {atk.url}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-mono",
                                atk.category === "SQL_INJECTION"
                                  ? "text-rose-700 bg-rose-50 border-rose-200"
                                  : atk.category === "XSS_ATTACK"
                                  ? "text-amber-700 bg-amber-50 border-amber-200"
                                  : atk.category === "COMMAND_INJECTION"
                                  ? "text-purple-700 bg-purple-50 border-purple-200"
                                  : "text-blue-700 bg-blue-50 border-blue-200"
                              )}
                            >
                              {atk.category}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-700 font-semibold">{atk.rule}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-rose-700 bg-rose-50/30 rounded max-w-xs truncate" title={atk.matchedValue}>
                            {atk.matchedValue}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: AUDIT LOGS ── */}
      {activeTab === "audit-logs" && (
        <Card className="border-gray-200 shadow-sm animate-fade-in">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-emerald-700" />
                  Security Audit Telemetry
                </CardTitle>
                <CardDescription className="text-xs">
                  Chronological trail of authentications, privilege checks, and administrative actions
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search logs by user, IP, action..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-gray-50/50"
                  />
                </div>

                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">All Severities</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ALL">All Categories</option>
                  <option value="AUTH">AUTH</option>
                  <option value="ACCESS">ACCESS</option>
                  <option value="POLICY">POLICY</option>
                  <option value="SECURITY">SECURITY</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">User / Actor</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        No audit records match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">{log.action}</td>
                        <td className="py-3 px-4">
                          {log.userName || log.userEmail ? (
                            <div>
                              <p className="font-semibold text-gray-900">{log.userName || log.userEmail}</p>
                              {log.userRole && (
                                <span className="text-[10px] text-gray-500 font-mono">{log.userRole}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 font-mono">System</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-gray-600">{log.category}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-mono",
                              log.severity === "CRITICAL"
                                ? "text-rose-700 bg-rose-50 border-rose-200"
                                : log.severity === "WARN"
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-blue-700 bg-blue-50 border-blue-200"
                            )}
                          >
                            {log.severity}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-mono",
                              log.status === "SUCCESS"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : log.status === "BLOCKED"
                                ? "text-rose-700 bg-rose-50 border-rose-200"
                                : "text-gray-700 bg-gray-50 border-gray-200"
                            )}
                          >
                            {log.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-500">{log.ipAddress}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: ACTIVE SESSIONS ── */}
      {activeTab === "sessions" && (
        <Card className="border-gray-200 shadow-sm animate-fade-in">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-blue-600" />
                  Active Connected Sessions
                </CardTitle>
                <CardDescription className="text-xs">
                  Inspect and terminate live client sessions and device credentials
                </CardDescription>
              </div>

              <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 font-mono text-xs w-fit">
                {sessions.length} Active Session{sessions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Device / Agent</th>
                    <th className="py-3 px-4">Authenticated At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-xs">
                            {sess.user?.firstName?.[0] || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {sess.user ? `${sess.user.firstName} ${sess.user.lastName}` : "Authenticated User"}
                            </p>
                            <p className="text-[11px] text-gray-500">{sess.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {sess.user?.role || "USER"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">{sess.ipAddress}</td>
                      <td className="py-3 px-4 max-w-xs text-gray-500 truncate" title={sess.userAgent}>
                        {sess.userAgent}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap">
                        {new Date(sess.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sess.isCurrent ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                            Current Session
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeSession(sess.id)}
                            className="text-xs h-7 px-2.5 text-rose-700 border-rose-200 hover:bg-rose-50"
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: RBAC MATRIX ── */}
      {activeTab === "rbac" && (
        <Card className="border-gray-200 shadow-sm animate-fade-in">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Role-Based Access Control (RBAC) Authority Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              System access control boundaries enforced by server authentication middleware
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {rbacModules.map((mod, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{mod.module}</h3>
                  <p className="text-xs text-gray-500">{mod.description}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-gray-600 uppercase text-[10px] font-semibold border-y border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Permission / Capability</th>
                        <th className="py-2.5 px-3 text-center">Admin</th>
                        <th className="py-2.5 px-3 text-center">Teacher</th>
                        <th className="py-2.5 px-3 text-center">Student</th>
                        <th className="py-2.5 px-3 text-center">Parent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {mod.permissions.map((perm, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-medium text-gray-900">{perm.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            {perm.admin ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {perm.teacher ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {perm.student ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {perm.parent ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 5: POLICIES ── */}
      {activeTab === "policies" && policies && (
        <form onSubmit={handleSavePolicies}>
          <Card className="border-gray-200 shadow-sm animate-fade-in">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Access & Lockout Policies Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Fine-tune session lifespans, inactivity sentinels, and brute-force throttling rules
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Inactivity Lock */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    Inactivity Sentinel Screen-Lock
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically blurs sensitive student data and requires PIN / password re-entry after idle time
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={policies.inactivityLockMinutes}
                    onChange={(e) =>
                      setPolicies({
                        ...policies,
                        inactivityLockMinutes: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-20 px-3 py-1.5 text-center text-sm font-bold rounded-xl border border-gray-200 bg-white"
                  />
                  <span className="text-xs text-gray-500 font-medium">minutes</span>
                </div>
              </div>

              {/* Max Failed Logins Before Lockout */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Max Failed Login Attempts Before IP Lockout
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Temporarily blocks IP from login attempts if exceeded within 1 minute
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={policies.maxFailedLoginsBeforeLockout}
                    onChange={(e) =>
                      setPolicies({
                        ...policies,
                        maxFailedLoginsBeforeLockout: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-20 px-3 py-1.5 text-center text-sm font-bold rounded-xl border border-gray-200 bg-white"
                  />
                  <span className="text-xs text-gray-500 font-medium">attempts</span>
                </div>
              </div>

              {/* Strong Password Enforcement */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    Enforce Strong Password Complexity
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requires upper, lower, numbers, and minimum length on password resets
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policies.requireStrongPassword}
                  onChange={(e) =>
                    setPolicies({ ...policies, requireStrongPassword: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* 2FA Enforcement */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Two-Factor Authentication (2FA) for Admins
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Require second-factor OTP code for administrative logins
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policies.twoFactorEnforced}
                  onChange={(e) =>
                    setPolicies({ ...policies, twoFactorEnforced: e.target.checked })
                  }
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={savingPolicies}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
                  }}
                >
                  <Save className="w-4 h-4" />
                  {savingPolicies ? "Saving Policies..." : "Save Security Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
