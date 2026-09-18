"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LogOut,
  Camera,
  Save,
  Loader2,
  Heart,
  Droplet,
  Phone,
  Mail,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATION_TYPES = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Other"];

interface ParentProfileData {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  occupation: string | null;
  address: string | null;
  city: string | null;
  watan: string | null;
  bloodGroup: string | null;
  its: string | null;
  relationType: string | null;
  notes: string | null;
  children: Array<{
    studentId: string;
    studentName: string;
    grade: string;
    section: string;
    avatarUrl?: string | null;
    relationship?: string | null;
  }>;
}

export default function ParentSettingsPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ParentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast({ variant: "success", title: "Password Changed", description: "Your account password has been updated securely." });
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

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    secondaryPhone: "",
    occupation: "",
    address: "",
    city: "",
    watan: "",
    bloodGroup: "",
    its: "",
    relationType: "Father",
    notes: "",
  });

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/parent/profile");
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setProfile(p);
        setForm({
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          phone: p.phone || "",
          secondaryPhone: p.secondaryPhone || "",
          occupation: p.occupation || "",
          address: p.address || "",
          city: p.city || "",
          watan: p.watan || "",
          bloodGroup: p.bloodGroup || "",
          its: p.its || "",
          relationType: p.relationType || "Father",
          notes: p.notes || "",
        });
      }
    } catch (err) {
      console.error("Failed to load parent profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parent/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setProfile((prev) => (prev ? { ...prev, avatarUrl: data.url } : null));
        toast({ variant: "success", title: "Photo Updated", description: "Your profile picture has been updated." });
      } else {
        toast({ variant: "destructive", title: "Upload Failed", description: data.error || "Failed to upload photo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not upload image." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ variant: "warning", title: "Required", description: "First name and last name are required." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/parent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Profile Saved", description: "Your parent profile information is updated." });
        await fetchProfile();
      } else {
        toast({ variant: "destructive", title: "Save Failed", description: data.error || "Failed to update profile." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not save profile changes." });
    } finally {
      setSaving(false);
    }
  };

  const user = session?.user;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)" }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
              >
                <Heart className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-xs text-white font-semibold mb-1">
                  Family Sanctuary &amp; Account
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Parent Profile &amp; Settings
                </h1>
                <p className="text-emerald-100 text-sm mt-0.5">
                  Update your personal information, contact numbers, blood group, and view enrolled children.
                </p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </div>
      </motion.div>

      {/* Profile Form Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-3xl border border-rose-100 bg-white shadow-sm overflow-hidden mb-6">
          <CardContent className="p-6 sm:p-8">
            {/* Avatar & Photo Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 mb-6 border-b border-gray-100">
              <div className="relative group shrink-0">
                <Avatar className="w-24 h-24 rounded-3xl border-4 border-rose-100 shadow-md ring-2 ring-rose-50">
                  {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="Parent" />}
                  <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white font-black text-2xl">
                    {getInitials(form.firstName || user?.firstName || "", form.lastName || user?.lastName || "")}
                  </AvatarFallback>
                </Avatar>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 bg-black/40 rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1"
                >
                  {uploadingAvatar ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                  <span>Change</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">
                    {form.firstName || user?.firstName} {form.lastName || user?.lastName}
                  </h2>
                  <Badge className="text-xs bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase">
                    {form.relationType || "PARENT"}
                  </Badge>
                  {form.bloodGroup && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-mono">
                      <Droplet className="w-3 h-3 text-red-500 fill-red-500" />
                      {form.bloodGroup}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {profile?.email || user?.email}
                </p>

                <div className="flex items-center gap-3 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="text-xs h-8 gap-1.5 border-rose-200 text-rose-800 hover:bg-rose-50"
                  >
                    <Camera className="w-4 h-4" />
                    {uploadingAvatar ? "Uploading..." : "Upload Profile Photo"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* First Name */}
                <div>
                  <label htmlFor="pFirstName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    First Name *
                  </label>
                  <input
                    id="pFirstName"
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="pLastName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Last Name *
                  </label>
                  <input
                    id="pLastName"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Last Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>

                {/* Relation Role */}
                <div>
                  <label htmlFor="pRelation" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Relationship Role
                  </label>
                  <select
                    id="pRelation"
                    value={form.relationType}
                    onChange={(e) => setForm({ ...form, relationType: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white transition-all"
                  >
                    {RELATION_TYPES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label htmlFor="pBlood" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Blood Group
                  </label>
                  <select
                    id="pBlood"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white font-mono transition-all"
                  >
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Phone */}
                <div>
                  <label htmlFor="pPhone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Primary Phone / Mobile
                  </label>
                  <input
                    id="pPhone"
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono transition-all"
                  />
                </div>

                {/* Secondary Phone / WhatsApp */}
                <div>
                  <label htmlFor="pSecPhone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Secondary Phone / WhatsApp
                  </label>
                  <input
                    id="pSecPhone"
                    type="text"
                    value={form.secondaryPhone}
                    onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                    placeholder="+92 321 7654321"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono transition-all"
                  />
                </div>

                {/* ITS Number */}
                <div>
                  <label htmlFor="pIts" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    ITS Number (8 Digits)
                  </label>
                  <input
                    id="pIts"
                    type="text"
                    value={form.its}
                    onChange={(e) => setForm({ ...form, its: e.target.value })}
                    placeholder="30345678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono transition-all"
                  />
                </div>

                {/* Occupation */}
                <div>
                  <label htmlFor="pOccupation" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Occupation / Profession
                  </label>
                  <input
                    id="pOccupation"
                    type="text"
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                    placeholder="e.g. Business, Engineer, Merchant"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>

                {/* City */}
                <div>
                  <label htmlFor="pCity" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    City of Residence
                  </label>
                  <input
                    id="pCity"
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Karachi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>

                {/* Watan */}
                <div>
                  <label htmlFor="pWatan" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Watan (Native / Ancestral Town)
                  </label>
                  <input
                    id="pWatan"
                    type="text"
                    value={form.watan}
                    onChange={(e) => setForm({ ...form, watan: e.target.value })}
                    placeholder="e.g. Surat, Sidhpur"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>

                {/* Address Full Width */}
                <div className="sm:col-span-2">
                  <label htmlFor="pAddress" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Residential Address
                  </label>
                  <textarea
                    id="pAddress"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Complete residential address..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-4 flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#047857] hover:bg-[#065f46] text-white font-bold px-6 py-2.5 rounded-xl shadow-md gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Profile Details
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Linked Children Showcase */}
      {profile && profile.children && profile.children.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <Card className="rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-[#047857]" />
                <h3 className="font-display font-bold text-gray-900 text-base">
                  Enrolled Talabat (Children) ({profile.children.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.children.map((child) => (
                  <div
                    key={child.studentId}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100"
                  >
                    <Avatar className="w-10 h-10 rounded-xl border border-emerald-200 shrink-0">
                      {child.avatarUrl && <AvatarImage src={child.avatarUrl} alt={child.studentName} />}
                      <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-xs">
                        {getInitials(child.studentName.split(" ")[0], child.studentName.split(" ")[1] || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">{child.studentName}</p>
                      <p className="text-xs text-gray-500">
                        Grade {child.grade}{child.section}
                        {child.relationship && (
                          <span className="text-emerald-700 font-medium ml-1.5">· {child.relationship}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Change Password Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
        <Card className="rounded-3xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-base">Change Account Password</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Update your personal password (minimum 8 characters with letters &amp; numbers).
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
                  <label htmlFor="pCurPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Current Password *
                  </label>
                  <input
                    id="pCurPass"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="pNewPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    New Password *
                  </label>
                  <input
                    id="pNewPass"
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
                  <label htmlFor="pConfPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Confirm New Password *
                  </label>
                  <input
                    id="pConfPass"
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
