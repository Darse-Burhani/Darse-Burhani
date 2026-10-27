"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Upload,
  Plus,
  Search,
  Calendar,
  Clock,
  Tv,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  Eye,
  Download,
  Filter,
  RefreshCw,
  FileText,
  Sparkles,
  Users,
  GraduationCap,
  Star,
  Layers,
  ChevronRight,
  ExternalLink,
  Shield,
  Loader2,
  X,
  FileCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { TilawatDuaViewer, type TilawatDuaItem } from "@/components/tilawat-dua/TilawatDuaViewer";

const MARHALA_OPTIONS = [
  { id: "ALL", label: "All Marhalas" },
  { id: "MARHALA_4", label: "Marhala 4 (Darajah Rabea)" },
  { id: "MARHALA_5", label: "Marhala 5 (Darajah Khamesa)" },
  { id: "MARHALA_6", label: "Marhala 6 (Darajah Sadesa)" },
  { id: "MARHALA_7", label: "Marhala 7 (Darajah Sabea)" },
  { id: "MARHALA_8", label: "Marhala 8 (Darajah Samena)" },
];

export default function AdminTilawatDuaPage() {
  const [items, setItems] = useState<TilawatDuaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("ALL_AUDIENCES");
  const [selectedDateFilter, setSelectedDateFilter] = useState("");
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string; grade: string }>>([]);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TilawatDuaItem | null>(null);
  const [selectedForView, setSelectedForView] = useState<TilawatDuaItem | null>(null);
  const [projectorItem, setProjectorItem] = useState<TilawatDuaItem | null>(null);

  // Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formAudience, setFormAudience] = useState("ALL");
  const [formMarhala, setFormMarhala] = useState("ALL");
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDailyDefault, setFormIsDailyDefault] = useState(true);
  const [formPdfUrl, setFormPdfUrl] = useState("");
  const [formFileName, setFormFileName] = useState("");
  const [formFileSize, setFormFileSize] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch records
  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (audienceFilter !== "ALL_AUDIENCES") params.set("audience", audienceFilter);
      if (selectedDateFilter) params.set("date", selectedDateFilter);

      const res = await fetch(`/api/tilawat-dua?${params.toString()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (err) {
      toast.error("Failed to load Tilawat Dua records");
    } finally {
      setLoading(false);
    }
  };

  // Fetch classes for assignment targeting
  useEffect(() => {
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((res) => {
        if (res.classes && Array.isArray(res.classes)) {
          setClassesList(res.classes);
        } else if (res.data && Array.isArray(res.data)) {
          setClassesList(res.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchItems();
  }, [search, audienceFilter, selectedDateFilter]);

  // Handle PDF file selection & upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a valid PDF document (.pdf)");
      return;
    }

    setUploadFile(file);
    setFormFileName(file.name);
    setFormFileSize(file.size);

    // Auto-populate Title if empty
    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormTitle(cleanName);
    }

    // Direct upload to server
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tilawat-dua/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to upload PDF");
      }

      setFormPdfUrl(json.url);
      toast.success("PDF uploaded and validated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
      setUploadFile(null);
    } finally {
      setUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setUploadFile(null);
    setFormTitle("");
    setFormDescription("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormAudience("ALL");
    setFormMarhala("ALL");
    setFormClassIds([]);
    setFormIsActive(true);
    setFormIsDailyDefault(true);
    setFormPdfUrl("");
    setFormFileName("");
    setFormFileSize(null);
    setEditingItem(null);
  };

  // Open modal for new upload
  const handleOpenUploadModal = () => {
    resetForm();
    setIsUploadModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (item: TilawatDuaItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormDate(new Date(item.date).toISOString().split("T")[0]);
    setFormAudience(item.targetAudience || "ALL");
    setFormMarhala(item.targetMarhala || "ALL");
    setFormClassIds(Array.isArray((item as any).targetClassIds) ? (item as any).targetClassIds : []);
    setFormIsActive(item.isActive ?? true);
    setFormIsDailyDefault(item.isDailyDefault ?? false);
    setFormPdfUrl(item.pdfUrl);
    setFormFileName(item.fileName);
    setFormFileSize(item.fileSize || null);
    setIsUploadModalOpen(true);
  };

  // Save Record (Create or Update)
  const handleSaveRecord = async () => {
    if (!formTitle.trim()) {
      toast.error("Please enter a title for Tilawat Dua");
      return;
    }
    if (!formPdfUrl) {
      toast.error("Please select and upload a PDF file");
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        date: formDate,
        targetAudience: formAudience,
        targetMarhala: formAudience === "MARHALA" ? formMarhala : null,
        targetClassIds: formAudience === "CLASS" ? formClassIds : [],
        isActive: formIsActive,
        isDailyDefault: formIsDailyDefault,
        pdfUrl: formPdfUrl,
        fileName: formFileName,
        fileSize: formFileSize,
      };

      const url = editingItem ? `/api/tilawat-dua/${editingItem.id}` : "/api/tilawat-dua";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save Tilawat Dua record");
      }

      toast.success(editingItem ? "Tilawat Dua updated successfully" : "Tilawat Dua published successfully");
      setIsUploadModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to save record");
    }
  };

  // Toggle Active
  const handleToggleActive = async (item: TilawatDuaItem) => {
    try {
      const res = await fetch(`/api/tilawat-dua/${item.id}/toggle-active`, { method: "PATCH" });
      const json = await res.json();
      if (json.success) {
        toast.success(`Tilawat Dua is now ${json.data.isActive ? "Active" : "Inactive"}`);
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isActive: json.data.isActive } : x)));
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Set Daily Default
  const handleSetDefault = async (item: TilawatDuaItem) => {
    try {
      const res = await fetch(`/api/tilawat-dua/${item.id}/set-default`, { method: "PATCH" });
      const json = await res.json();
      if (json.success) {
        toast.success("Set as Today's Default Tilawat Dua");
        fetchItems();
      }
    } catch {
      toast.error("Failed to set default");
    }
  };

  // Delete Record
  const handleDelete = async (item: TilawatDuaItem) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) return;

    try {
      const res = await fetch(`/api/tilawat-dua/${item.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Tilawat Dua deleted successfully");
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }
    } catch {
      toast.error("Failed to delete record");
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    const dailyDefault = items.find((x) => x.isDailyDefault);
    return { total, active, dailyDefault };
  }, [items]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Top Header & Hero ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/60 p-6 sm:p-8 text-white border border-slate-700/60 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold tracking-wider uppercase border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Academic & Spiritual Daily Routine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Tilawat Dua Management</h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl">
              Upload daily Tilawat Dua PDFs, assign specific target groups (All, Faculty, Talabat, Marhalas, or Classes),
              and launch classroom presentations with high-fidelity Projector View.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {stats.dailyDefault && (
              <Button
                onClick={() => setProjectorItem(stats.dailyDefault || null)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/30 rounded-xl"
              >
                <Tv className="w-4 h-4 mr-2" />
                Launch Today's Projector
              </Button>
            )}

            <Button
              onClick={handleOpenUploadModal}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-600/30 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Tilawat Dua PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Overview Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Duas</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in Portals</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Daily Default</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {stats.dailyDefault ? stats.dailyDefault.title : "None Set (Set Below)"}
            </p>
          </div>
        </Card>
      </div>

      {/* ── Filters & Search Bar ── */}
      <Card className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Tilawat Dua title, notes, or file…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Audience filter */}
            <select
              value={audienceFilter}
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL_AUDIENCES">All Audiences</option>
              <option value="ALL">All (Faculty & Talabat)</option>
              <option value="TALABAT">Talabat Only</option>
              <option value="FACULTY">Faculty Only</option>
              <option value="MARHALA">Specific Marhala</option>
              <option value="CLASS">Specific Class</option>
            </select>

            {/* Date filter */}
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            {(search || audienceFilter !== "ALL_AUDIENCES" || selectedDateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setAudienceFilter("ALL_AUDIENCES");
                  setSelectedDateFilter("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={fetchItems} className="text-slate-500 hover:text-slate-800">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Records List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm font-medium">Loading Tilawat Dua collection…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Tilawat Dua records found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Upload your first daily Tilawat Dua PDF document to enable projector display and dynamic student/faculty viewing.
          </p>
          <Button onClick={handleOpenUploadModal} className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Upload Tilawat Dua PDF
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const formattedDate = new Date(item.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const sizeInMb = item.fileSize ? (item.fileSize / (1024 * 1024)).toFixed(2) : null;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
              >
                <div className="p-5 space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.isDailyDefault && (
                        <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 text-[11px] font-bold px-2 py-0.5">
                          <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                          Today's Default
                        </Badge>
                      )}
                      <Badge
                        className={`text-[11px] font-medium px-2 py-0.5 ${
                          item.isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200"
                        }`}
                      >
                        {item.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>

                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-amber-600 transition truncate">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-medium text-slate-600 dark:text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {item.targetAudience === "ALL"
                        ? "All Portals"
                        : item.targetAudience === "TALABAT"
                        ? "Talabat"
                        : item.targetAudience === "FACULTY"
                        ? "Faculty"
                        : item.targetAudience === "MARHALA"
                        ? `${item.targetMarhala || "Marhala"}`
                        : "Specific Classes"}
                    </span>

                    {sizeInMb && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-500 font-mono text-[11px]">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {sizeInMb} MB
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {/* Projector View Launch Button */}
                    <Button
                      size="sm"
                      onClick={() => setProjectorItem(item)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-sm"
                      title="Launch Fullscreen Projector"
                    >
                      <Tv className="w-3.5 h-3.5 mr-1.5" />
                      Projector
                    </Button>

                    {/* Quick View Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedForView(item)}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 text-xs h-8 px-2.5 rounded-xl"
                      title="Preview in Modal"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Make Daily Default */}
                    {!item.isDailyDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(item)}
                        title="Set as Today's Default"
                        className="text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 h-8 px-2"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Toggle Active */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(item)}
                      title={item.isActive ? "Hide from portals" : "Show in portals"}
                      className="text-xs text-slate-500 hover:text-slate-800 h-8 px-2"
                    >
                      {item.isActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </Button>

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit details"
                      className="text-xs text-slate-500 hover:text-slate-800 h-8 px-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      title="Delete record"
                      className="text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-8 px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Upload & Edit Modal ── */}
      <Modal open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <ModalContent className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 space-y-6">
          <ModalHeader>
            <ModalTitle className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              {editingItem ? "Edit Tilawat Dua Details" : "Upload Daily Tilawat Dua PDF"}
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4">
            {/* File Upload Dropzone (if not editing or replacing) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                PDF Document File <span className="text-rose-500">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  formPdfUrl
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:bg-amber-50/20 dark:hover:bg-amber-950/20"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Uploading & verifying PDF magic bytes…
                    </p>
                  </div>
                ) : formPdfUrl ? (
                  <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="w-10 h-10" />
                    <p className="text-sm font-bold truncate max-w-sm">{formFileName}</p>
                    <p className="text-xs text-slate-500">
                      Click to choose a different PDF file (Max 60MB)
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload className="w-8 h-8 text-amber-500" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Click or drag daily Tilawat Dua PDF here
                    </p>
                    <p className="text-xs text-slate-400">Supports all standard PDF documents up to 60MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Tilawat Dua Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tilawat al-Quran & Dua al-Sabah"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Schedule Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Audience Targeting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Audience
                </label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All (Faculty & Talabat)</option>
                  <option value="TALABAT">Talabat Only</option>
                  <option value="FACULTY">Faculty / Teachers Only</option>
                  <option value="MARHALA">Specific Marhala</option>
                  <option value="CLASS">Specific Classes</option>
                </select>
              </div>

              {formAudience === "MARHALA" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Marhala
                  </label>
                  <select
                    value={formMarhala}
                    onChange={(e) => setFormMarhala(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {MARHALA_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Specific Classes Multi-select */}
            {formAudience === "CLASS" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Applicable Classes
                </label>
                <div className="max-h-36 overflow-y-auto p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                  {classesList.map((cls) => {
                    const isChecked = formClassIds.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:text-amber-500"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormClassIds((prev) => [...prev, cls.id]);
                            } else {
                              setFormClassIds((prev) => prev.filter((id) => id !== cls.id));
                            }
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>{cls.name}</span>
                        {cls.grade && <span className="text-[10px] text-slate-400">({cls.grade})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Notes / Surah & Dua Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Surah Yasin, Dua al-Sabah, Tasbeeh"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDailyDefault}
                  onChange={(e) => setFormIsDailyDefault(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Set as Today's Default for Classroom Projectors
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Visible & Published in Portals
                </span>
              </label>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRecord}
              disabled={uploading}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : editingItem ? (
                "Save Changes"
              ) : (
                "Publish Tilawat Dua"
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Modal In-Page Preview Viewer ── */}
      {selectedForView && (
        <Modal open={!!selectedForView} onOpenChange={() => setSelectedForView(null)}>
          <ModalContent className="max-w-5xl bg-slate-950 p-2 sm:p-4 rounded-3xl border border-slate-800">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2 text-white">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm truncate">{selectedForView.title}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedForView(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <TilawatDuaViewer dua={selectedForView} />
          </ModalContent>
        </Modal>
      )}

      {/* ── Dedicated Standalone Fullscreen Projector Overlay ── */}
      {projectorItem && (
        <TilawatDuaViewer
          dua={projectorItem}
          initialProjectorMode={true}
          onCloseProjector={() => setProjectorItem(null)}
        />
      )}
    </div>
  );
}
