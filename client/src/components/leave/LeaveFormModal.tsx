"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  X,
  Calendar,
  Stethoscope,
  User,
  AlertCircle,
  FileText,
  UploadCloud,
  CheckCircle2,
  Loader2,
  HeartPulse,
} from "lucide-react";
import { submitTalabatLeave } from "@/lib/api";

interface LeaveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const leaveTypes = [
  {
    type: "MEDICAL" as const,
    label: "Medical / Sick Leave",
    icon: Stethoscope,
    description: "Illness, medical consultations, recovery",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    badge: "Doctor note recommended",
  },
  {
    type: "PERSONAL" as const,
    label: "Personal Leave",
    icon: User,
    description: "Personal or family obligations",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    type: "FAMILY_EMERGENCY" as const,
    label: "Family Emergency",
    icon: HeartPulse,
    description: "Urgent family situations or bereavement",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    type: "OTHER" as const,
    label: "Other Leave",
    icon: FileText,
    description: "Official representation, visa, or travel",
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
];

export function LeaveFormModal({ isOpen, onClose, onSuccess }: LeaveFormModalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<"MEDICAL" | "PERSONAL" | "FAMILY_EMERGENCY" | "OTHER">("MEDICAL");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate day count
  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [startDate, endDate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds maximum allowed size (10 MB)");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "File upload failed");
      }

      setAttachmentUrl(json.data?.url || json.url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a reason with at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitTalabatLeave({
        type,
        startDate,
        endDate,
        reason: reason.trim(),
        attachmentUrl: attachmentUrl.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto min-h-[100dvh]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-900 to-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Request Leave</h3>
              <p className="text-xs text-emerald-200/80">Submit an official leave application</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Leave Type Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Leave Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {leaveTypes.map((item) => {
                const isSelected = type === item.type;
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setType(item.type)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="font-bold text-xs text-gray-900 leading-snug">{item.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{item.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="leave-start-date" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                From Date
              </label>
              <input
                id="leave-start-date"
                type="date"
                required
                min={todayStr}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label htmlFor="leave-end-date" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                To Date
              </label>
              <input
                id="leave-end-date"
                type="date"
                required
                min={startDate || todayStr}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          {/* Duration Summary Pill */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs">
            <span className="text-gray-600 font-medium">Duration:</span>
            <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
              {durationDays} {durationDays === 1 ? "day" : "days"}
            </span>
          </div>

          {/* Reason */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="leave-reason" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Reason / Details
              </label>
              <span className="text-[11px] text-gray-400 font-medium">{reason.length} / 500</span>
            </div>
            <textarea
              id="leave-reason"
              rows={3}
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the reason for taking leave (e.g. fever, doctor consultation, family engagement)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 resize-none"
            />
          </div>

          {/* Medical Attachment / Doctor Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Attachment (Optional)
            </label>
            {attachmentUrl ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2 truncate text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Document uploaded</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl("")}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-2 shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-gray-400" />
                  )}
                  <span>{uploading ? "Uploading document..." : "Upload medical note or slip (PDF, JPG, PNG)"}</span>
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? "Submitting..." : "Submit Leave Request"}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
