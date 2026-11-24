"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Plus,
  Barcode,
  Filter,
  X,
  ChevronDown,
  Edit3,
  Trash2,
  BookMarked,
  BookX,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Layers,
  Library,
  Scan,
  SlidersHorizontal,
  Loader2,
  Printer,
  Upload,
  ImageIcon,
  Download,
  CheckSquare,
  Keyboard,
  History,
  Clock,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  QrCode,
  Copy,
  LayoutGrid,
  Tag,
  Sparkles,
  UserCheck,
  Check,
  ExternalLink,
  Eye,
  ArrowUpRight,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import PrintBarcodeLabels from "@/components/admin/PrintBarcodeLabels";
import BarcodeDisplay from "@/components/admin/BarcodeDisplay";
import QRCodeDisplay from "@/components/admin/QRCodeDisplay";
import BookScanModal from "@/components/admin/BookScanModal";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { LIBRARY_HUB_TABS, LIBRARY_HUB_TITLE, LIBRARY_HUB_DESCRIPTION } from "@/lib/library-tabs";
import Link from "next/link";

// ── Types ──
interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn?: string | null;
  category: string;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  coverImage: string | null;
  status: "AVAILABLE" | "BORROWED" | "RESTOCK_QUEUE" | "DAMAGED" | "LOST";
  totalCopies: number;
  availableCopies: number;
  notes: string | null;
  currentBorrower: string | null;
  currentLoanId: string | null;
  loanDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  name: string;
  count: number;
}

// ── Status Badge Config ──
const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  AVAILABLE: { label: "On Shelf", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  BORROWED: { label: "Issued", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: BookMarked },
  RESTOCK_QUEUE: { label: "In Sorting", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: RotateCcw },
  DAMAGED: { label: "Damaged", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: BookX },
  LOST: { label: "Lost", color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: AlertTriangle },
};

// ── Color Config ──
const colorConfig: Record<string, string> = {
  Red: "bg-red-500",
  Blue: "bg-blue-500",
  Green: "bg-green-500",
  Yellow: "bg-yellow-400",
  Orange: "bg-orange-500",
  Purple: "bg-purple-500",
  Pink: "bg-pink-500",
  "Light Blue": "bg-sky-400",
  White: "bg-white border border-gray-300",
};

// ── Helper ──
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Stat Card ──
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="fatimi-card">
      <div className="fatimi-card-header" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <Icon className={`w-4 h-4 ${color}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Add Book Modal ──
// ── Image Preview Modal ──
function ImagePreviewModal({ file, previewUrl, open, onOpenChange, onConfirm, onCancel }: {
  file: File;
  previewUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-700" />
            Preview Cover Image
          </ModalTitle>
          <ModalDescription>
            Review the image before uploading &middot; {(file.size / 1024 / 1024).toFixed(1)}MB
          </ModalDescription>
        </ModalHeader>
        <div className="flex justify-center py-4">
          <div className="w-56 h-80 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-lg">
            <img
              src={previewUrl}
              alt="Book cover preview before upload"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-400">{file.name}</p>
          <p className="text-xs text-gray-400">{file.type.split("/")[1].toUpperCase()}</p>
        </div>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button type="button" variant="admin" onClick={onConfirm}>
            <Upload className="w-4 h-4 mr-1" />
            Upload Photo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AddBookModal({ open, onOpenChange, onCreated, existingCategories }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  existingCategories: string[];
}) {
  const [form, setForm] = useState({
    title: "",
    author: "",
    category: "General",
    rackNumber: "",
    shelfNumber: "",
    coverImage: "",
  });
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success state after adding a book
  const [successData, setSuccessData] = useState<{
    title: string;
    barcode: string;
    author: string;
    category: string;
  } | null>(null);

  // Dynamic related book title suggestions for proper naming
  const [titleSuggestions, setTitleSuggestions] = useState<any[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);

  useEffect(() => {
    const q = form.title.trim();
    if (!q || q.length < 2) {
      setTitleSuggestions([]);
      setShowTitleSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/library/checkout/search-books?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setTitleSuggestions(data.data);
          setShowTitleSuggestions(data.data.length > 0);
        }
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [form.title]);

  const processFile = (file: File) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid File", description: "Please select JPEG, PNG, WebP, GIF, or AVIF", variant: "destructive" });
      return;
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }
    
    const previewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreviewUrl(previewUrl);
    setShowPreviewModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handlePreviewConfirm = async () => {
    if (!pendingFile) return;
    
    setShowPreviewModal(false);
    setForm((p) => ({ ...p, coverImage: pendingPreviewUrl }));

    // Upload to server
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      URL.revokeObjectURL(pendingPreviewUrl);
      if (data.success) {
        setForm((p) => ({ ...p, coverImage: data.url }));
        toast({ title: "Photo Uploaded", description: "Cover image uploaded successfully", variant: "success" });
      } else {
        setForm((p) => ({ ...p, coverImage: "" }));
        toast({ title: "Upload Failed", description: data.error || "Failed to upload image", variant: "destructive" });
      }
    } catch {
      URL.revokeObjectURL(pendingPreviewUrl);
      setForm((p) => ({ ...p, coverImage: "" }));
      toast({ title: "Upload Failed", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setPendingFile(null);
      setPendingPreviewUrl("");
      setUploadingCover(false);
    }
  };

  const handlePreviewCancel = () => {
    URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl("");
    setShowPreviewModal(false);
  };

  const handleRemoveCover = () => {
    setForm((p) => ({ ...p, coverImage: "" }));
    toast({ title: "Photo Removed", description: "Cover image has been removed", variant: "default" });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setShowNewCategory(true);
      setNewCategoryName("");
    } else {
      setShowNewCategory(false);
      setForm((p) => ({ ...p, category: val }));
    }
  };

  const handleAddNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setForm((p) => ({ ...p, category: trimmed }));
    setShowNewCategory(false);
    setNewCategoryName("");
    toast({ title: "New Category", description: `"${trimmed}" will be used for this book`, variant: "success" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          totalCopies: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const barcode = data.data?.barcode;
        const createdTitle = data.data?.title || form.title;
        toast({ 
          title: "Book Added", 
          description: `"${createdTitle}" added to inventory`,
          variant: "success" 
        });

        // Show barcode success screen
        if (barcode) {
          setSuccessData({
            title: createdTitle,
            barcode,
            author: data.data?.author || form.author || "",
            category: data.data?.category || form.category,
          });
        } else {
          onCreated();
          onOpenChange(false);
          setForm({
            title: "", author: "", category: "General",
            rackNumber: "", shelfNumber: "", coverImage: "",
          });
          setShowNewCategory(false);
          setNewCategoryName("");
        }
      } else {
        toast({ title: "Error", description: data.error || "Failed to add book", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to add book", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBarcode = () => {
    if (!successData) return;
    // Open print window with a single barcode label
    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print labels", variant: "destructive" });
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcode</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; font-family: 'Courier New', monospace; }
          .label { border: 1px solid #ccc; border-radius: 4px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 2.625in; background: white; }
          .barcode-wrap { width: 100%; display: flex; justify-content: center; }
          .barcode-wrap svg { max-width: 100%; height: 40px; }
          .barcode-text { font-size: 7px; font-weight: bold; letter-spacing: 1px; color: #222; }
          .title { font-size: 6.5px; font-weight: 500; color: #333; text-align: center; }
          .meta { font-size: 5.5px; color: #888; }
          @media print { body { padding: 0; } .label { border: 0.5px solid #999; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="barcode-wrap">
            <svg class="barcode-svg" data-barcode="${successData.barcode}"></svg>
          </div>
          <div class="barcode-text">${successData.barcode}</div>
          <div class="title">${escapeHtml(successData.title)}</div>
          <div class="meta">${escapeHtml(successData.category)}${successData.author ? ` · ${escapeHtml(successData.author)}` : ""}</div>
        </div>
        <script>
          document.querySelectorAll('.barcode-svg').forEach(function(svg) {
            try {
              JsBarcode(svg, svg.dataset.barcode, { format: 'CODE128', width: 1.2, height: 30, displayValue: false, margin: 0 });
            } catch(e) {}
          });
          window.addEventListener('afterprint', function() { window.close(); });
          setTimeout(function() { window.print(); }, 400);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCloseSuccess = () => {
    setSuccessData(null);
    setForm({
      title: "", author: "", category: "General",
      rackNumber: "", shelfNumber: "", coverImage: "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    onCreated();
    onOpenChange(false);
  };

  const handleAddAnother = () => {
    setSuccessData(null);
    setForm({
      title: "", author: "", category: "General",
      rackNumber: "", shelfNumber: "", coverImage: "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    onCreated();
  };

  // Build category options: unique existing + default list
  const allCategories = Array.from(new Set([
    "General", "Fiction", "Non-Fiction", "Science", "History", "Religion",
    "Mathematics", "Language", "Arts", "Biography", "Reference", "Children",
    "Self-Help", "Technology",
    ...existingCategories,
  ])).sort();

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o && !loading) { setSuccessData(null); } onOpenChange(o); }}>
      <ModalContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        {/* ── Success Screen with Barcode ── */}
        {successData ? (
          <>
            <ModalHeader>
              <ModalTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Book Added Successfully
              </ModalTitle>
              <ModalDescription>
                &ldquo;{successData.title}&rdquo; has been added to the library inventory
              </ModalDescription>
            </ModalHeader>
            <div className="flex flex-col items-center py-4 space-y-4">
              {/* Barcode Preview Card */}
              <div className="bg-white border-2 border-emerald-100 rounded-2xl p-6 shadow-lg flex flex-col items-center gap-3 w-full max-w-xs">
                <div className="w-full bg-white rounded-xl p-3 flex flex-col items-center border border-gray-100">
                  <BarcodeDisplay value={successData.barcode} scale="lg" showText={true} />
                </div>
                <div className="text-center w-full">
                  <p className="text-sm font-semibold text-gray-800 truncate">{successData.title}</p>
                  {successData.author && (
                    <p className="text-xs text-gray-500 truncate">{successData.author}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      {successData.category}
                    </span>
                    <span className="text-[10px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {successData.barcode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  onClick={handleAddAnother}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Another
                </Button>
                <Button
                  variant="admin"
                  onClick={handlePrintBarcode}
                  className="flex-1"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print Label
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={handleCloseSuccess}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Done — Back to Library
              </Button>
            </div>
          </>
        ) : (
          <>
            <ModalHeader>
              <ModalTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-700" />
                Add New Book to Inventory
              </ModalTitle>
              <ModalDescription>Fill in the book details and upload a cover photo</ModalDescription>
            </ModalHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image Upload with Drag & Drop */}
          <div className="flex flex-col items-center mb-2">
            <div
              ref={fileInputRef as any}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                // Create a temporary input for file selection
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
                input.onchange = (e: any) => handleFileSelect(e);
                input.click();
              }}
              className={`w-36 h-48 rounded-xl overflow-hidden bg-gray-100 border-2 flex items-center justify-center shadow-md cursor-pointer transition-all duration-200 relative group ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50 scale-105"
                  : form.coverImage
                    ? "border-emerald-300 hover:border-emerald-400"
                    : "border-dashed border-gray-300 hover:border-emerald-400"
              }`}
            >
              {form.coverImage && !uploadingCover ? (
                <img
                  src={form.coverImage}
                  alt="Book cover preview"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(form.title || "Book")}&background=6366f1&color=fff&size=160`;
                  }}
                />
              ) : (
                <div className={`flex flex-col items-center justify-center px-3 text-center transition-colors ${dragOver ? "text-emerald-700" : "text-gray-500"}`}>
                  {dragOver ? (
                    <>
                      <Upload className="w-10 h-10 mb-2 text-emerald-500 animate-bounce" />
                      <span className="text-xs font-medium text-emerald-700">Drop to add!</span>
                    </>
                  ) : uploadingCover ? (
                    <>
                      <Loader2 className="w-10 h-10 mb-2 text-emerald-500 animate-spin" />
                      <span className="text-xs font-medium text-emerald-700">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-2" />
                      <span className="text-[10px] font-medium">Drop photo here</span>
                      <span className="text-[10px] text-gray-400 mt-1">or click to browse</span>
                    </>
                  )}
                </div>
              )}
              {/* Hover overlay when image exists */}
              {form.coverImage && !uploadingCover && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col items-center justify-center gap-1">
                  <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg">
                    Drop or Click to Change
                  </span>
                </div>
              )}
              {/* Uploading overlay */}
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            {uploadingCover && (
              <div className="flex items-center gap-1.5 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                <span className="text-xs text-emerald-700">Uploading to server...</span>
              </div>
            )}
            {!uploadingCover && form.coverImage && (
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-emerald-700 font-medium">✓ Cover photo ready</p>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="text-[10px] text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                >
                  Remove Photo
                </button>
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1">Drag & drop or click · Max 5MB</p>
          </div>

          {/* Book Name / Title with Dynamic Drop Bar */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="add-title" className="block text-sm font-medium text-gray-700">
                Name of the Book <span className="text-red-500">*</span>
              </label>
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                  {titleSuggestions.length} matching in catalog
                </span>
              )}
            </div>
            <input
              type="text"
              id="add-title"
              name="addTitle"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              onFocus={() => {
                if (titleSuggestions.length > 0) setShowTitleSuggestions(true);
              }}
              placeholder="Enter book title (e.g. Nahjul Balagha, Kalam Sharif...)"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />

            {/* Dynamic Dropdown of Related Books */}
            <AnimatePresence>
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border-2 border-emerald-300/80 overflow-hidden max-h-56 overflow-y-auto"
                >
                  <div className="p-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Matching Existing Books in Catalog
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTitleSuggestions(false)}
                      className="text-[10.5px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {titleSuggestions.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            title: b.title,
                            author: b.author || p.author,
                            category: b.category || p.category,
                            rackNumber: b.rackNumber || p.rackNumber,
                          }));
                          setShowTitleSuggestions(false);
                          toast({
                            title: "Proper Title Adopted 📖",
                            description: `Standardized as "${b.title}"`,
                            variant: "default",
                          });
                        }}
                        className="p-2.5 hover:bg-emerald-50/70 cursor-pointer transition-colors flex items-center justify-between gap-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{b.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {b.author ? `By ${b.author}` : "Author unlisted"} &middot; {b.category || "General"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Barcode: {b.barcode || "N/A"} {b.rackNumber ? `· Rack: ${b.rackNumber}` : ""}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                          {b.availableCopies > 0 ? `${b.availableCopies} available` : "Checked out"}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Author */}
          <div>
            <label htmlFor="add-author" className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              type="text"
              id="add-author"
              name="addAuthor"
              value={form.author}
              onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
              placeholder="Author name"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Category with Add New option */}
          <div>
            <label htmlFor="add-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            {showNewCategory ? (
              <div className="flex gap-2">
                <label htmlFor="add-new-category" className="sr-only">New category name</label>
                <input
                  type="text"
                  id="add-new-category"
                  name="addNewCategory"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Type new category name"
                  className="flex-1 rounded-xl border border-emerald-400 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNewCategory(); } }}
                />
                <Button type="button" size="sm" variant="admin" onClick={handleAddNewCategory} disabled={!newCategoryName.trim()}>
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewCategory(false); setForm((p) => ({ ...p, category: "General" })); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <select
                  id="add-category"
                  name="addCategory"
                  value={form.category}
                  onChange={handleCategoryChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none appearance-none bg-white"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__new__" className="text-emerald-700 font-medium border-t border-gray-200">➕ Add New Category...</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Shelf Location + Rack */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-shelf" className="block text-sm font-medium text-gray-700 mb-1">Shelf Location</label>
              <input
                type="text"
                id="add-shelf"
                name="addShelf"
                value={form.shelfNumber}
                onChange={(e) => setForm((p) => ({ ...p, shelfNumber: e.target.value }))}
                placeholder="e.g., A, B, C"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="add-rack" className="block text-sm font-medium text-gray-700 mb-1">Rack</label>
              <input
                type="text"
                id="add-rack"
                name="addRack"
                value={form.rackNumber}
                onChange={(e) => setForm((p) => ({ ...p, rackNumber: e.target.value }))}
                placeholder="e.g., R1, R2"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || uploadingCover} variant="admin">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Add to Inventory
            </Button>
          </ModalFooter>
        </form>
          </>
        )}
      </ModalContent>

      {/* Image Preview Modal */}
      {pendingFile && (
        <ImagePreviewModal
          file={pendingFile}
          previewUrl={pendingPreviewUrl}
          open={showPreviewModal}
          onOpenChange={(open) => { if (!open) handlePreviewCancel(); else setShowPreviewModal(true); }}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}
    </Modal>
  );
}

// ── Edit Book Modal ──
function EditBookModal({ book, open, onOpenChange, onUpdated, existingCategories }: {
  book: LibraryBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  existingCategories: string[];
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string>("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    if (book) {
      setForm({
        id: book.id,
        title: book.title,
        author: book.author || "",
        publisher: book.publisher || "",
        category: book.category,
        barcode: book.barcode || "",
        rackNumber: book.rackNumber || "",
        shelfNumber: book.shelfNumber || "",
        locationColor: book.locationColor || "",
        coverImage: book.coverImage || "",
        totalCopies: book.totalCopies,
        notes: book.notes || "",
      });
    }
  }, [book]);

  const processFile = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid File", description: "Please select JPEG, PNG, WebP, GIF, or AVIF", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingPreviewUrl(previewUrl);
    setShowPreviewModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handlePreviewConfirm = async () => {
    if (!pendingFile) return;
    
    setShowPreviewModal(false);
    setForm((p: any) => ({ ...p, coverImage: pendingPreviewUrl }));

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      URL.revokeObjectURL(pendingPreviewUrl);
      if (data.success) {
        setForm((p: any) => ({ ...p, coverImage: data.url }));
        toast({ title: "Photo Uploaded", description: "Cover image updated", variant: "success" });
      } else {
        setForm((p: any) => ({ ...p, coverImage: "" }));
        toast({ title: "Upload Failed", description: data.error || "Failed to upload image", variant: "destructive" });
      }
    } catch {
      URL.revokeObjectURL(pendingPreviewUrl);
      setForm((p: any) => ({ ...p, coverImage: "" }));
      toast({ title: "Upload Failed", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setPendingFile(null);
      setPendingPreviewUrl("");
      setUploadingCover(false);
    }
  };

  const handlePreviewCancel = () => {
    URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl("");
    setShowPreviewModal(false);
  };

  const handleRemoveCover = () => {
    setForm((p: any) => ({ ...p, coverImage: "" }));
    toast({ title: "Photo Removed", description: "Cover image has been removed", variant: "default" });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") {
      setShowNewCategory(true);
      setNewCategoryName("");
    } else {
      setShowNewCategory(false);
      setForm((p: any) => ({ ...p, category: val }));
    }
  };

  const handleAddNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setForm((p: any) => ({ ...p, category: trimmed }));
    setShowNewCategory(false);
    setNewCategoryName("");
    toast({ title: "New Category", description: `"${trimmed}" will be used for this book`, variant: "success" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) {
      toast({ title: "Validation Error", description: "Title is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, totalCopies: Number(form.totalCopies) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Book Updated", description: `"${form.title}" has been updated`, variant: "success" });
        onOpenChange(false);
        onUpdated();
      } else {
        toast({ title: "Error", description: data.error || "Failed to update book", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update book", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const allCategories = Array.from(new Set([
    "General", "Fiction", "Non-Fiction", "Science", "History", "Religion",
    "Mathematics", "Language", "Arts", "Biography", "Reference", "Children",
    "Self-Help", "Technology",
    ...existingCategories,
  ])).sort();

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-600" />
            Edit Book
          </ModalTitle>
          <ModalDescription>Update book details and location</ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image Upload with Drag & Drop */}
          <div className="flex flex-col items-center mb-2">
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
                input.onchange = (e: any) => handleFileSelect(e);
                input.click();
              }}
              className={`w-36 h-48 rounded-xl overflow-hidden bg-gray-100 border-2 flex items-center justify-center shadow-md cursor-pointer transition-all duration-200 relative group ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50 scale-105"
                  : form.coverImage
                    ? "border-emerald-300 hover:border-emerald-400"
                    : "border-dashed border-gray-300 hover:border-emerald-400"
              }`}
            >
              {form.coverImage && !uploadingCover ? (
                <img
                  src={form.coverImage}
                  alt="Book cover preview"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(form.title || "Book")}&background=6366f1&color=fff&size=160`;
                  }}
                />
              ) : (
                <div className={`flex flex-col items-center justify-center px-3 text-center transition-colors ${dragOver ? "text-emerald-700" : "text-gray-500"}`}>
                  {dragOver ? (
                    <>
                      <Upload className="w-10 h-10 mb-2 text-emerald-500 animate-bounce" />
                      <span className="text-xs font-medium text-emerald-700">Drop to update!</span>
                    </>
                  ) : uploadingCover ? (
                    <>
                      <Loader2 className="w-10 h-10 mb-2 text-emerald-500 animate-spin" />
                      <span className="text-xs font-medium text-emerald-700">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mb-2" />
                      <span className="text-[10px] font-medium">Drop photo here</span>
                      <span className="text-[10px] text-gray-400 mt-1">or click to browse</span>
                    </>
                  )}
                </div>
              )}
              {form.coverImage && !uploadingCover && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col items-center justify-center gap-1">
                  <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-1 rounded-lg">
                    Drop or Click to Change
                  </span>
                </div>
              )}
              {uploadingCover && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
            {uploadingCover && (
              <div className="flex items-center gap-1.5 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                <span className="text-xs text-emerald-700">Uploading to server...</span>
              </div>
            )}
            {!uploadingCover && form.coverImage && (
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-emerald-700 font-medium">✓ Cover photo ready</p>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="text-[10px] text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                >
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" id="edit-title" name="editTitle" value={form.title || ""} onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value }))} required className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-author" className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input type="text" id="edit-author" name="editAuthor" value={form.author || ""} onChange={(e) => setForm((p: any) => ({ ...p, author: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label htmlFor="edit-publisher" className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
              <input type="text" id="edit-publisher" name="editPublisher" value={form.publisher || ""} onChange={(e) => setForm((p: any) => ({ ...p, publisher: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              {showNewCategory ? (
                <div className="flex gap-1">
                  <label htmlFor="edit-new-category" className="sr-only">New category name</label>
                  <input
                    type="text"
                    id="edit-new-category"
                    name="editNewCategory"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category"
                    className="flex-1 rounded-xl border border-emerald-400 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNewCategory(); } }}
                  />
                  <Button type="button" size="sm" variant="admin" onClick={handleAddNewCategory} disabled={!newCategoryName.trim()}>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewCategory(false); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="edit-category"
                    name="editCategory"
                    value={form.category || "General"}
                    onChange={handleCategoryChange}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__new__" className="text-emerald-700 font-medium">➕ Add New...</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
            <div>
              <label htmlFor="edit-rack" className="block text-sm font-medium text-gray-700 mb-1">Rack</label>
              <input type="text" id="edit-rack" name="editRack" value={form.rackNumber || ""} onChange={(e) => setForm((p: any) => ({ ...p, rackNumber: e.target.value }))} placeholder="e.g., R1" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label htmlFor="edit-shelf" className="block text-sm font-medium text-gray-700 mb-1">Shelf</label>
              <input type="text" id="edit-shelf" name="editShelf" value={form.shelfNumber || ""} onChange={(e) => setForm((p: any) => ({ ...p, shelfNumber: e.target.value }))} placeholder="e.g., A" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </div>
          <div>
              <label htmlFor="edit-spine-color" className="block text-sm font-medium text-gray-700 mb-1">Spine Color</label>
              <select id="edit-spine-color" name="editSpineColor" value={form.locationColor || ""} onChange={(e) => setForm((p: any) => ({ ...p, locationColor: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">None</option>
                {Object.keys(colorConfig).map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          <div>
            <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="edit-status" name="editStatus" value={form.status || "AVAILABLE"} onChange={(e) => setForm((p: any) => ({ ...p, status: e.target.value }))} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="AVAILABLE">Available</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || uploadingCover}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>

      {/* Image Preview Modal */}
      {pendingFile && (
        <ImagePreviewModal
          file={pendingFile}
          previewUrl={pendingPreviewUrl}
          open={showPreviewModal}
          onOpenChange={(open) => { if (!open) handlePreviewCancel(); else setShowPreviewModal(true); }}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}
    </Modal>
  );
}

// ── Loan History Section ──
function LoanHistorySection({ bookId }: { bookId: string }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/library/history?bookId=${bookId}`);
        const data = await res.json();
        if (!cancelled && data.success) setLoans(data.data);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No loan history for this book</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {loans.map((loan) => (
        <div
          key={loan.id}
          className={`flex items-center gap-3 p-3 rounded-xl border ${
            loan.status === "ACTIVE"
              ? "bg-amber-50 border-amber-200"
              : "bg-gray-50 border-gray-100"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            loan.status === "ACTIVE" ? "bg-amber-200" : "bg-emerald-100"
          }`}>
            {loan.status === "ACTIVE" ? (
              <BookMarked className="w-4 h-4 text-amber-700" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{loan.studentName}</span>
              {loan.studentInfo && (
                <span className="text-[10px] text-gray-400 bg-white px-1.5 py-0.5 rounded-full border">
                  {loan.studentInfo.className || `G${loan.studentInfo.grade}-${loan.studentInfo.section}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Issued: {new Date(loan.borrowedAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Due: {new Date(loan.dueAt).toLocaleDateString()}
              </span>
              {loan.returnedAt && (
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" />
                  Returned: {new Date(loan.returnedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            loan.status === "ACTIVE"
              ? "bg-amber-100 text-amber-700"
              : loan.status === "RETURNED"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
          }`}>
            {loan.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Book Detail Modal (with tabs) ──
function BookDetailModal({ book, open, onOpenChange }: {
  book: LibraryBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"details" | "history">("details");

  if (!book) return null;
  const statusInfo = statusConfig[book.status] || statusConfig.AVAILABLE;
  const StatusIcon = statusInfo.icon;

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) setTab("details"); onOpenChange(o); }}>
      <ModalContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-xl">{book.title}</ModalTitle>
          <ModalDescription>
            {book.author && <span>by {book.author}</span>}
            {book.publisher && <span> &middot; {book.publisher}</span>}
          </ModalDescription>

          {/* Tab Switcher */}
          <div className="flex gap-1 mt-3 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTab("details")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === "details"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 inline mr-1" />
              Details
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === "history"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <History className="w-3.5 h-3.5 inline mr-1" />
              Loan History
            </button>
          </div>
        </ModalHeader>
        
        {tab === "details" ? (
          <div className="space-y-4">
            {/* Cover Image + Status */}
            <div className="flex gap-4">
              <div className="w-28 h-40 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 shadow-md">
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={`Cover of ${book.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=6366f1&color=fff&size=160`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-200">
                    <BookOpen className="w-10 h-10 text-emerald-400 mb-1" />
                    <span className="text-[10px] text-emerald-500 font-medium px-2 text-center">No Cover</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusInfo.label}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                    Digital Tags &amp; Physical Codes
                  </span>
                  {book.barcode && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(book.barcode || "");
                        toast({ title: "Copied!", description: `Barcode ${book.barcode} copied to clipboard`, variant: "success" });
                      }}
                      className="text-[11px] font-mono text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-50 transition-colors shadow-2xs"
                    >
                      Copy: {book.barcode}
                    </button>
                  )}
                </div>

                {book.barcode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 2D QR Code */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-emerald-600" />
                        2D QR Matrix (Mobile)
                      </span>
                      <QRCodeDisplay value={book.barcode} size={110} />
                      <span className="font-mono text-[10px] text-slate-600 font-semibold mt-1">
                        {book.barcode}
                      </span>
                    </div>

                    {/* 1D Laser Barcode */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-emerald-600" />
                        1D Code-128 (Laser)
                      </span>
                      <div className="py-2 flex items-center justify-center w-full overflow-hidden">
                        <BarcodeDisplay value={book.barcode} scale="sm" showText={false} />
                      </div>
                      <span className="font-mono text-[10px] text-slate-600 font-semibold mt-1">
                        {book.barcode}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs font-medium">
                    No physical barcode assigned to this volume.
                  </div>
                )}
              </div>

              <div><span className="text-gray-500">Category:</span> <span className="font-medium text-gray-900">{book.category}</span></div>
              <div><span className="text-gray-500">Copies:</span> <span className="font-medium text-gray-900">{book.availableCopies}/{book.totalCopies} available</span></div>
              <div><span className="text-gray-500">Rack:</span> <span className="font-medium text-gray-900">{book.rackNumber || "—"}</span></div>
              <div><span className="text-gray-500">Shelf:</span> <span className="font-medium text-gray-900">{book.shelfNumber || "—"}</span></div>
              {book.locationColor && (
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-gray-500">Spine Label:</span>
                  <div className={`w-4 h-4 rounded ${colorConfig[book.locationColor] || "bg-gray-200"}`} />
                  <span className="font-medium text-gray-900">{book.locationColor}</span>
                </div>
              )}
            </div>

            {book.currentBorrower && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-medium text-amber-800">Currently borrowed by: {book.currentBorrower}</p>
                {book.dueDate && (
                  <p className="text-xs text-amber-600 mt-1">
                    Due: {new Date(book.dueDate).toLocaleDateString()}
                    {new Date(book.dueDate) < new Date() && <span className="text-red-600 font-semibold"> (OVERDUE)</span>}
                  </p>
                )}
              </div>
            )}

            {book.notes && (
              <div>
                <span className="text-sm text-gray-500">Notes:</span>
                <p className="text-sm text-gray-700 mt-1">{book.notes}</p>
              </div>
            )}

            <p className="text-xs text-gray-400">Added {new Date(book.createdAt).toLocaleDateString()}</p>
          </div>
        ) : (
          <LoanHistorySection bookId={book.id} />
        )}
        
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Delete Confirmation Modal ──
function DeleteBookModal({ book, open, onOpenChange, onDeleted }: {
  book: LibraryBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!book) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/library?id=${book.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Book Deleted", description: `"${book.title}" has been removed`, variant: "success" });
        onOpenChange(false);
        onDeleted();
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete book", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete book", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Delete Book
          </ModalTitle>
          <ModalDescription>
            Are you sure you want to delete &ldquo;{book?.title}&rdquo;? This action cannot be undone.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function getGenreGradient(category: string): string {
  switch (category) {
    case "Manshoraat":
    case "Asfar":
      return "from-purple-500/15 via-purple-500/5 to-transparent";
    case "Science":
    case "Math":
    case "Space":
    case "Geography":
      return "from-blue-500/15 via-blue-500/5 to-transparent";
    case "Fiction":
    case "Linguistic":
      return "from-emerald-500/15 via-emerald-500/5 to-transparent";
    case "Biography":
    case "History":
    case "Psychology":
      return "from-amber-500/15 via-amber-500/5 to-transparent";
    case "Commerce":
    case "Management":
    case "Self help":
      return "from-orange-500/15 via-orange-500/5 to-transparent";
    case "GK":
    case "Quiz":
    case "PT":
      return "from-sky-500/15 via-sky-500/5 to-transparent";
    default:
      return "from-slate-500/10 via-slate-500/5 to-transparent";
  }
}

// ── Single Book Printable Barcode Sticker Modal ──
function SingleBarcodeStickerModal({
  book,
  open,
  onOpenChange,
}: {
  book: LibraryBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!book) return null;
  const barcodeVal = book.barcode || book.id.slice(0, 8).toUpperCase();
  const loc = [book.rackNumber, book.shelfNumber].filter(Boolean).join(" · ") || "Library Shelf";

  const handlePrintSingle = () => {
    const printWindow = window.open("", "_blank", "width=600,height=500");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print barcode stickers", variant: "destructive" });
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Sticker - ${escapeHtml(book.title)}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Arabic", Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #fff;
            padding: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Standard 2.5in x 1.2in / 50mm x 30mm barcode sticker label */
          .sticker {
            width: 2.5in;
            height: 1.2in;
            max-height: 1.2in;
            border: 1px dashed #065f46;
            border-radius: 4px;
            padding: 0.06in 0.08in;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            background: #fff;
            box-sizing: border-box;
            overflow: hidden;
          }
          .hdr {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 1.5px;
            margin-bottom: 1px;
          }
          .genre {
            font-size: 7.5px;
            font-weight: 800;
            text-transform: uppercase;
            color: #065f46;
            letter-spacing: 0.4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 60%;
          }
          .loc {
            font-size: 6.5px;
            font-weight: 700;
            background: #fef3c7;
            color: #92400e;
            padding: 1px 3px;
            border-radius: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 38%;
          }
          .barcode-box {
            margin: 1px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 28px;
            overflow: hidden;
          }
          .code-row {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            line-height: 1;
          }
          .code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 9px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.8px;
          }
          .title {
            width: 100%;
            font-size: 9.5px;
            font-weight: 700;
            color: #0f172a;
            text-align: center;
            line-height: 1.2;
            max-height: 23px;
            overflow: hidden;
            direction: auto;
          }
          @media print {
            body { background: transparent; padding: 0; }
            .sticker { border: 1px solid #94a3b8; }
          }
        </style>
      </head>
      <body>
        <div class="sticker">
          <div class="hdr">
            <span class="genre">${escapeHtml(book.category || "General")}</span>
            <span class="loc">${escapeHtml(loc)}</span>
          </div>
          <div class="barcode-box">
            <svg id="singleBarcode"></svg>
          </div>
          <div class="code-row">
            <span class="code">${barcodeVal}</span>
          </div>
          <div class="title">${escapeHtml(book.title)}</div>
        </div>
        <script>
          JsBarcode("#singleBarcode", "${barcodeVal}", {
            format: "CODE128",
            width: 1.25,
            height: 26,
            displayValue: false,
            margin: 0,
            background: "#ffffff"
          });
          window.addEventListener('afterprint', function() { window.close(); });
          setTimeout(function() { window.print(); }, 400);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md rounded-3xl p-6">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-emerald-700" />
            Standard Barcode Sticker
          </ModalTitle>
          <ModalDescription>
            Official 2.5&quot; &times; 1.2&quot; standard sticker label for library book
          </ModalDescription>
        </ModalHeader>

        <div className="py-4 flex flex-col items-center">
          <div className="w-full max-w-xs rounded-2xl border-2 border-emerald-600/60 bg-white p-3.5 shadow-md flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between border-b border-emerald-100 pb-1.5 mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {book.category}
              </span>
              <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[150px]">
                {loc}
              </span>
            </div>

            <div className="my-1.5 w-full flex justify-center overflow-hidden">
              <BarcodeDisplay value={barcodeVal} scale="md" showText={false} />
            </div>

            <div className="flex items-center gap-2 mt-0.5 mb-1.5">
              <span className="font-mono text-xs font-extrabold text-slate-900 tracking-wider">
                {barcodeVal}
              </span>
            </div>

            <p className="font-bold text-xs text-slate-800 text-center line-clamp-2">
              {book.title}
            </p>
          </div>
        </div>

        <ModalFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(barcodeVal);
              toast({ title: "Copied!", description: `Barcode ${barcodeVal} copied to clipboard`, variant: "success" });
            }}
            className="rounded-xl"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copy Code
          </Button>

          <Button
            type="button"
            onClick={handlePrintSingle}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Sticker
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

interface InitialData {
  books: LibraryBook[];
  categories: Category[];
  stats: { total: number; available: number; borrowed: number; restock: number };
}

// ── Main Page (Client Component) ──
export default function LibraryClient({ initialData }: { initialData?: InitialData }) {
  const [books, setBooks] = useState<LibraryBook[]>(initialData?.books || []);
  const [categories, setCategories] = useState<Category[]>(() => {
    return (initialData?.categories || []).map((c: any) => ({
      name: String(c.name || ""),
      count: typeof c.count === "object" ? Number(c.count?.id ?? c.count?._all ?? 0) : Number(c.count || 0),
    }));
  });
  const [loading, setLoading] = useState(!initialData);
  const [stats, setStats] = useState(initialData?.stats || { total: 0, available: 0, borrowed: 0, restock: 0 });
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  
  // Search & filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanModalBarcode, setScanModalBarcode] = useState<string>("");
  const [showPrintLabelsModal, setShowPrintLabelsModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [singleBarcodeBook, setSingleBarcodeBook] = useState<LibraryBook | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sorting & Copy Feedback
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"title" | "author" | "category" | "available">("title");
  const [sortAsc, setSortAsc] = useState(true);

  const copyBarcode = useCallback((barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
    toast({ title: "Barcode Copied", description: `${barcode} copied to clipboard`, variant: "success" });
  }, []);

  // ── Fetch Books ──
  const fetchBooks = useCallback(async (searchTerm = search, cat = categoryFilter, stat = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (cat) params.set("category", cat);
      if (stat) params.set("status", stat);
      
      const res = await fetch(`/api/admin/library?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setBooks(data.data);
        const rawCats = data.categories || [];
        const normalizedCats: Category[] = rawCats.map((c: any) => ({
          name: String(c.name || ""),
          count: typeof c.count === "object" ? Number(c.count?.id ?? c.count?._all ?? 0) : Number(c.count || 0),
        }));
        setCategories(normalizedCats);
        
        const total = data.data.length;
        const available = data.data.filter((b: LibraryBook) => b.status === "AVAILABLE").length;
        const borrowed = data.data.filter((b: LibraryBook) => b.status === "BORROWED").length;
        const restock = data.data.filter((b: LibraryBook) => b.status === "RESTOCK_QUEUE").length;
        setStats({ total: data.total || total, available, borrowed, restock });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load library books", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) fetchBooks();
  }, []);

  // Memoized dynamic sorting
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "title") comparison = a.title.localeCompare(b.title);
      else if (sortBy === "author") comparison = (a.author || "").localeCompare(b.author || "");
      else if (sortBy === "category") comparison = a.category.localeCompare(b.category);
      else if (sortBy === "available") comparison = b.availableCopies - a.availableCopies;
      return sortAsc ? comparison : -comparison;
    });
  }, [books, sortBy, sortAsc]);

  // ── Debounced Search ──
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchBooks(value, categoryFilter, statusFilter);
    }, 300);
  };

  const handleFilterChange = (type: string, value: string) => {
    if (type === "category") setCategoryFilter(value);
    if (type === "status") setStatusFilter(value);
    
    // Refetch immediately
    const newCat = type === "category" ? value : categoryFilter;
    const newStat = type === "status" ? value : statusFilter;
    fetchBooks(search, newCat, newStat);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setStatusFilter("");
    fetchBooks("", "", "");
  };

  // ── Bulk Selection ──
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const toggleBulkSelect = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (bulkSelected.size === books.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(books.map((b) => b.id)));
    }
  };

  const clearBulkSelection = () => {
    setBulkSelected(new Set());
    setSelectMode(false);
  };

  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return;
    if (!confirm(`Delete ${bulkSelected.size} book(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/library/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIds: Array.from(bulkSelected) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Bulk Delete", description: data.message, variant: "success" });
        clearBulkSelection();
        fetchBooks();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete books", variant: "destructive" });
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (bulkSelected.size === 0) return;
    try {
      const res = await fetch("/api/admin/library/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookIds: Array.from(bulkSelected),
          updates: { status },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Bulk Update", description: `Updated ${data.count} book(s) to ${status}`, variant: "success" });
        clearBulkSelection();
        fetchBooks();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update books", variant: "destructive" });
    }
  };

  // ── Export CSV ──
  const handleExportCSV = async () => {
    try {
      toast({ title: "Exporting...", description: "Preparing your CSV download", variant: "default" });
      const res = await fetch("/api/admin/library/export?format=csv");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `library-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Library data downloaded as CSV", variant: "success" });
    } catch {
      toast({ title: "Export Failed", description: "Could not export library data", variant: "destructive" });
    }
  };

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      if (e.key === "/" || (e.ctrlKey && e.key === "f")) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        setShowAddModal(true);
      }
      if (e.key === "b" && e.ctrlKey) {
        e.preventDefault();
        setSelectMode((p) => !p);
        if (selectMode) setBulkSelected(new Set());
      }
      if (e.key === "Escape") {
        if (bulkSelected.size > 0) clearBulkSelection();
      }
      if (e.key === "r" && e.ctrlKey) {
        e.preventDefault();
        fetchBooks();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fetchBooks, selectMode, bulkSelected.size]);

  // ── Global Hardware Barcode Gun Scanner Catch on Library Tab ──
  useEffect(() => {
    let scanBuffer = "";
    let lastKeyTime = 0;

    const handleGlobalBarcodeScan = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        const barcode = scanBuffer.trim();
        if (barcode.length >= 3) {
          if (!isInputFocused || barcode.startsWith("DB-") || barcode.includes("-") || /^[A-Z0-9]{5,}$/i.test(barcode)) {
            e.preventDefault();
            e.stopPropagation();
            setScanModalBarcode(barcode);
            setShowScanModal(true);
            scanBuffer = "";
            return;
          }
        }
        scanBuffer = "";
        return;
      }

      if (timeDiff > 140 && scanBuffer.length > 0) {
        scanBuffer = "";
      }

      if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalBarcodeScan, true);
    return () => window.removeEventListener("keydown", handleGlobalBarcodeScan, true);
  }, []);

  // ── Get location label ──
  const getLocationLabel = (book: LibraryBook) => {
    const parts = [];
    if (book.rackNumber) parts.push(book.rackNumber);
    if (book.shelfNumber) parts.push(book.shelfNumber);
    return parts.length ? parts.join("-") : "—";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Library Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle={LIBRARY_HUB_TITLE}
        hubDescription={LIBRARY_HUB_DESCRIPTION}
        tabs={LIBRARY_HUB_TABS}
      />

      {/* ── Executive Fatimi Gold & Midnight Operations Cockpit ── */}
      <div className="rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#121620] via-[#1a2333] to-[#0f141f] text-white shadow-xl border border-[#d4af37]/35 relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#d4af37]/20 text-[#fff4be] border border-[#d4af37]/40 flex items-center gap-2 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-[#f3b833] animate-pulse" />
                Maktabat Central Repository
              </span>
              <span className="text-xs text-stone-300 font-mono">
                {stats.total} Total Physical Volumes · {books.length} Active Catalog Titles
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 font-display">
              <Library className="w-6 h-6 text-[#f3b833]" />
              <span>Library Management &amp; Physical Inventory</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              Precision catalog tracking, scannable barcode circulation, live stock levels, and shelf coordinates across Darse Burhani.
            </p>
          </div>

          {/* Action Dock */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-[#d4af37] via-[#f3b833] to-[#c59b27] hover:from-[#c59b27] hover:to-[#b8860b] text-stone-950 font-black text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer border-none"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Add Book</span>
              <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-[9px] bg-black/20 rounded font-mono font-normal">Alt+A</kbd>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowScanModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl cursor-pointer"
              title="Open Barcode Scanner (Press Alt+S)"
            >
              <Scan className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <span>Scan Barcode</span>
            </Button>

            <Link href="/admin/library/checkout">
              <Button
                size="sm"
                variant="outline"
                className="bg-emerald-800/40 hover:bg-emerald-700/50 text-emerald-100 border-emerald-500/40 text-xs rounded-xl cursor-pointer shadow-sm"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                <span>Issue / Return Desk</span>
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPrintLabelsModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-[#f3b833]" />
              <span>Print Stickers</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectMode((p) => { if (p) setBulkSelected(new Set()); return !p; })}
              className={`text-xs rounded-xl cursor-pointer transition-all ${
                selectMode
                  ? "bg-amber-400 text-stone-950 font-black border-amber-500 shadow-md"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
              <span>{selectMode ? "Exit Bulk" : "Bulk Select"}</span>
              {bulkSelected.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-stone-900 text-white font-bold">
                  {bulkSelected.size}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs rounded-xl cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-stone-300" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Telemetry KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-left">
            <div className="flex items-center justify-between text-[11px] text-stone-300 font-semibold mb-1">
              <span>Total Inventory</span>
              <Library className="w-3.5 h-3.5 text-[#f3b833]" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.total}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">{books.length} titles recorded</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-emerald-500/20 text-left">
            <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold mb-1">
              <span>On Shelf (Available)</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 font-mono">{stats.available}</p>
            <p className="text-[10px] text-emerald-200/80 mt-0.5">
              {stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0}% available now
            </p>
          </div>

          <Link
            href="/admin/library/checkout?tab=issued"
            className="p-3.5 rounded-2xl bg-white/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] text-amber-300 font-semibold mb-1">
              <span>In Circulation</span>
              <BookMarked className="w-3.5 h-3.5 text-[#f3b833] group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-2xl font-black text-[#f3b833] font-mono">{stats.borrowed}</p>
            <p className="text-[10px] text-amber-200/80 mt-0.5 group-hover:underline">
              Volumes checked out &rarr;
            </p>
          </Link>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-blue-500/20 text-left">
            <div className="flex items-center justify-between text-[11px] text-blue-300 font-semibold mb-1">
              <span>Sorting Queue</span>
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-blue-400 font-mono">{stats.restock}</p>
            <p className="text-[10px] text-blue-200/80 mt-0.5">Awaiting restock</p>
          </div>
        </div>
      </div>

      {/* ── Modern Control Deck & Instant Filtering ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="fatimi-card mb-6 shadow-sm border-slate-200/80">
          <div className="fatimi-card-header" />
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Top Command Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Contextual Instant Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <label htmlFor="search-books" className="sr-only">Search library catalog</label>
                <input
                  type="text"
                  id="search-books"
                  name="searchBooks"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Instant search by title, author, barcode (DB-...), ISBN, or shelf location..."
                  className="w-full rounded-xl border border-slate-200/90 pl-10 pr-20 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50/80 hover:bg-slate-50 text-slate-900 transition-all placeholder:text-slate-400 shadow-inner"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  {search ? (
                    <button
                      type="button"
                      onClick={() => { setSearch(""); fetchBooks("", categoryFilter, statusFilter); }}
                      className="pointer-events-auto text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-200/60 rounded border border-slate-300/60">
                      /
                    </span>
                  )}
                </div>
              </div>

              {/* Controls Group */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                {/* Fast Sorting Dropdown */}
                <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-xs p-1">
                  <span className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none pr-6 cursor-pointer py-1"
                  >
                    <option value="title">Title (A-Z)</option>
                    <option value="author">Author</option>
                    <option value="category">Category</option>
                    <option value="available">Available Stock</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortAsc(!sortAsc)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={sortAsc ? "Sort ascending (A-Z / Low-High)" : "Sort descending (Z-A / High-Low)"}
                  >
                    <ArrowUpDown className={`w-3.5 h-3.5 transition-transform ${sortAsc ? "" : "rotate-180"}`} />
                  </button>
                </div>

                {/* Filter Toggle Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`shrink-0 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    showFilters || categoryFilter || statusFilter
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                  <span>Filters</span>
                  {(categoryFilter || statusFilter) && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-700 text-white font-extrabold">
                      {(categoryFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
                    </span>
                  )}
                </Button>

                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchBooks()}
                  className="shrink-0 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                  title="Refresh catalog data (Ctrl+R)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
                </Button>

                {/* View Mode Switcher */}
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "cards"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Bento visual book cards with scannable barcodes"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Bento Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "table"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Precision master table with scannable barcode actions"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Precision Table</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Circulation Status Segment Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto scrollbar-none pb-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                Status:
              </span>

              <button
                type="button"
                onClick={() => handleFilterChange("status", "")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                  !statusFilter
                    ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>All Books</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  !statusFilter ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 font-bold"
                }`}>
                  {stats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFilterChange("status", statusFilter === "AVAILABLE" ? "" : "AVAILABLE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                  statusFilter === "AVAILABLE"
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50/50"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>On Shelf</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === "AVAILABLE" ? "bg-emerald-900 text-white" : "bg-emerald-100 text-emerald-800 font-bold"
                }`}>
                  {stats.available}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFilterChange("status", statusFilter === "BORROWED" ? "" : "BORROWED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                  statusFilter === "BORROWED"
                    ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                    : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                <BookMarked className="w-3.5 h-3.5 text-amber-500" />
                <span>In Circulation</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === "BORROWED" ? "bg-amber-800 text-white" : "bg-amber-100 text-amber-800 font-bold"
                }`}>
                  {stats.borrowed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFilterChange("status", statusFilter === "RESTOCK_QUEUE" ? "" : "RESTOCK_QUEUE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                  statusFilter === "RESTOCK_QUEUE"
                    ? "bg-blue-700 text-white border-blue-800 shadow-xs"
                    : "bg-white text-blue-800 border-blue-200 hover:bg-blue-50/50"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                <span>Sorting Queue</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusFilter === "RESTOCK_QUEUE" ? "bg-blue-900 text-white" : "bg-blue-100 text-blue-800 font-bold"
                }`}>
                  {stats.restock}
                </span>
              </button>

              {(categoryFilter || statusFilter || search) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            {/* Expandable Advanced Filter Drawer */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl mt-2">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-bold">Discipline / Genre:</span>
                      <label htmlFor="filter-category" className="sr-only">Filter by category</label>
                      <select
                        id="filter-category"
                        name="filterCategory"
                        value={categoryFilter}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-800 font-semibold"
                      >
                        <option value="">All Disciplines ({categories.length})</option>
                        {categories.map((cat) => {
                          const countVal = typeof cat.count === "object" ? (cat.count as any)?.id ?? (cat.count as any)?._all ?? 0 : cat.count;
                          return (
                            <option key={cat.name} value={cat.name}>{cat.name} ({countVal})</option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-bold">Circulation Status:</span>
                      <label htmlFor="filter-status" className="sr-only">Filter by status</label>
                      <select
                        id="filter-status"
                        name="filterStatus"
                        value={statusFilter}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-slate-800 font-semibold"
                      >
                        <option value="">All Statuses</option>
                        <option value="AVAILABLE">On Shelf (Available)</option>
                        <option value="BORROWED">In Circulation (Issued)</option>
                        <option value="RESTOCK_QUEUE">Sorting &amp; Restock Queue</option>
                        <option value="DAMAGED">Damaged / Under Repair</option>
                        <option value="LOST">Lost</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Bulk Selection Floating Dock ── */}
      <AnimatePresence>
        {(selectMode || bulkSelected.size > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="mb-6 rounded-2xl border-2 border-amber-500/50 bg-amber-50/95 p-3.5 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center shadow-sm">
                {bulkSelected.size}
              </span>
              <div>
                <p className="text-xs font-black text-stone-950">
                  {bulkSelected.size === 0 ? "Bulk Selection Mode Active — Select books below" : `${bulkSelected.size} of ${books.length} Books Selected`}
                </p>
                <p className="text-[11px] text-amber-900/80">
                  Apply batch barcode label printing, inventory status updates, or bulk deletion
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={toggleSelectAll}
                className="text-xs rounded-xl border-amber-300 bg-white hover:bg-amber-100 text-amber-950 font-bold cursor-pointer"
              >
                {bulkSelected.size === books.length ? "Deselect All" : `Select All (${books.length})`}
              </Button>

              {bulkSelected.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPrintLabelsModal(true)}
                    className="text-xs rounded-xl border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    Print Labels ({bulkSelected.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBulkStatusChange("AVAILABLE")}
                    className="text-xs rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                  >
                    Set On Shelf
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBulkStatusChange("RESTOCK_QUEUE")}
                    className="text-xs rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold cursor-pointer"
                  >
                    Set Sorting
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkDelete}
                    className="text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete ({bulkSelected.size})
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={clearBulkSelection}
                className="text-xs text-amber-950 hover:text-stone-950 font-semibold cursor-pointer"
              >
                Exit Bulk
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Interactive Genre & Category Explorer Ribbon ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Discipline &amp; Genre Navigator ({categories.length} Disciplines)
            </h3>
          </div>
          {categoryFilter && (
            <button
              onClick={() => handleFilterChange("category", "")}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Genre
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
          <button
            onClick={() => handleFilterChange("category", "")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border flex items-center gap-2 ${
              !categoryFilter
                ? "bg-emerald-800 text-white border-emerald-900 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>All Disciplines</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              !categoryFilter ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {stats.total}
            </span>
          </button>

          {categories.map((cat) => {
            const isSelected = categoryFilter === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => handleFilterChange("category", isSelected ? "" : cat.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border flex items-center gap-2 ${
                  isSelected
                    ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`} />
                <span>{cat.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isSelected ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {typeof cat.count === "object" ? (cat.count as any)?.id ?? (cat.count as any)?._all ?? 0 : cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Catalog Display Section Header ── */}
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <span>
            {categoryFilter ? `${categoryFilter} Collection` : "Master Library Catalog"} &middot; {sortedBooks.length} Volumes Shown
          </span>
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="hidden sm:inline">
            Showing {sortedBooks.length} of {stats.total} total inventory
          </span>
          {categoryFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
              {categoryFilter}
              <button onClick={() => handleFilterChange("category", "")} className="hover:text-amber-950">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Dynamic Layout: Bento Visual Cards vs Precision Master Table ── */}
      {viewMode === "cards" ? (
        /* ── Bento Visual Cards View ── */
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-80 rounded-2xl bg-white border border-slate-200/80 p-4.5 animate-pulse flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-4 bg-slate-100 rounded w-16" />
                  </div>
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-16 bg-slate-200 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                    </div>
                  </div>
                  <div className="h-16 bg-slate-100 rounded-xl mb-3" />
                  <div className="h-6 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : sortedBooks.length === 0 ? (
            <Card className="fatimi-card p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <BookOpen className="w-12 h-12 text-slate-300" />
                <p className="text-slate-700 font-extrabold text-base">No books match your criteria</p>
                <p className="text-sm text-slate-400 max-w-md">
                  {search || categoryFilter || statusFilter
                    ? "Try adjusting your search keywords, status filter, or genre filter to view matching volumes."
                    : "No inventory currently recorded in this catalog. Start by adding a book."}
                </p>
                {(search || categoryFilter || statusFilter) ? (
                  <Button onClick={clearFilters} variant="outline" size="sm" className="mt-2 rounded-xl">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Filters
                  </Button>
                ) : (
                  <Button onClick={() => setShowAddModal(true)} size="sm" className="mt-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add First Volume
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
              {sortedBooks.map((book, index) => {
                const statusInfo = statusConfig[book.status] || statusConfig.AVAILABLE;
                const StatusIcon = statusInfo.icon;
                const barcodeVal = book.barcode || book.id.slice(0, 8).toUpperCase();
                const isSelected = bulkSelected.has(book.id);
                const locLabel = getLocationLabel(book);
                const totalCopies = Math.max(book.totalCopies || 1, 1);
                const availableCopies = book.availableCopies ?? (book.status === "AVAILABLE" ? 1 : 0);
                const stockRatio = Math.min(Math.max((availableCopies / totalCopies) * 100, 0), 100);

                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.3) }}
                    className={`group relative rounded-2xl border transition-all duration-200 bg-white flex flex-col justify-between overflow-hidden ${
                      isSelected
                        ? "border-amber-500 shadow-md ring-2 ring-amber-400/30"
                        : "border-slate-200/90 hover:border-emerald-300 hover:shadow-lg"
                    }`}
                  >
                    {/* Top Discipline Gradient Stripe */}
                    <div className={`h-2 w-full bg-gradient-to-r ${getGenreGradient(book.category)}`} />

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      {/* Top Header: Category Tag & Location Coordinates */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50/90 px-2 py-0.5 rounded-md border border-amber-200/80">
                            {book.category}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {locLabel && (
                              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                                {locLabel}
                              </span>
                            )}
                            {selectMode && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBulkSelect(book.id)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                            )}
                          </div>
                        </div>

                        {/* Visual Thumbnail & Metadata */}
                        <div className="flex items-start gap-3 mb-2.5">
                          <div
                            onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                            className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center shadow-xs"
                          >
                            {book.coverImage ? (
                              <img
                                src={book.coverImage}
                                alt={`Cover of ${book.title}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=10b981&color=fff&size=80`;
                                }}
                              />
                            ) : (
                              <BookOpen className="w-5 h-5 text-slate-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4
                              onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                              className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 cursor-pointer leading-snug"
                              title={book.title}
                            >
                              {book.title}
                            </h4>
                            <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                              {book.author || "Author unrecorded"}
                            </p>
                            {book.isbn && (
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                ISBN: {book.isbn}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Scannable Barcode & Monospace Strip with 1-Click Copy */}
                      <div
                        onClick={() => setSingleBarcodeBook(book)}
                        className="my-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 flex flex-col items-center hover:bg-amber-50/50 hover:border-amber-300 transition-all cursor-pointer group/barcode"
                        title="Click to preview & print barcode sticker"
                      >
                        <div className="w-full flex items-center justify-center overflow-hidden py-1">
                          <BarcodeDisplay
                            value={barcodeVal}
                            genre={book.category}
                            scale="sm"
                            showText={false}
                          />
                        </div>
                        <div className="w-full flex items-center justify-between gap-1.5 mt-1 pt-1.5 border-t border-slate-200/60">
                          <span className="font-mono text-[11px] font-extrabold text-slate-900 tracking-wider">
                            {barcodeVal}
                          </span>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => copyBarcode(barcodeVal)}
                              className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-white transition-colors"
                              title="Copy Barcode to clipboard"
                            >
                              {copiedBarcode === barcodeVal ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSingleBarcodeBook(book)}
                              className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-white transition-colors"
                              title="Print Sticker"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Stock Level & Circulation Status */}
                      <div className="space-y-1.5 my-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Stock Availability</span>
                          <span className="font-mono font-extrabold text-slate-800">
                            {availableCopies} / {totalCopies} Copies
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              availableCopies === 0
                                ? "bg-rose-500"
                                : stockRatio < 50
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${stockRatio}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Footer: Status Badge & Quick Operations */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between mt-auto gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Quick Issue Direct Link */}
                          <Link
                            href={`/admin/library/checkout?bookBarcode=${encodeURIComponent(barcodeVal)}`}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors shadow-xs"
                            title="Issue volume at checkout desk"
                          >
                            <span>Issue</span>
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                          </Link>

                          {/* Quick Preview */}
                          <button
                            type="button"
                            onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="View Full Book Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => { setSelectedBook(book); setShowEditModal(true); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Edit Book Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => { setSelectedBook(book); setShowDeleteModal(true); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      ) : (
        /* ── Precision Master Table View ── */
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card className="fatimi-card shadow-sm border-slate-200/80 overflow-hidden">
            <div className="fatimi-card-header" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    {selectMode && (
                      <th className="px-4 py-3 text-left w-8">
                        <input
                          type="checkbox"
                          checked={bulkSelected.size === sortedBooks.length && sortedBooks.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="text-left px-3.5 py-3 w-12">Cover</th>
                    <th className="text-left px-4 py-3">Barcode &amp; Actions</th>
                    <th className="text-left px-4 py-3">Title &amp; Author</th>
                    <th className="text-left px-4 py-3">Discipline</th>
                    <th className="text-left px-4 py-3">Location</th>
                    <th className="text-left px-4 py-3">Stock Gauge</th>
                    <th className="text-left px-4 py-3">Circulation Status</th>
                    <th className="text-right px-4 py-3">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={selectMode ? 9 : 8} className="px-4 py-4">
                          <div className="h-5 bg-slate-100 rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : sortedBooks.length === 0 ? (
                    <tr>
                      <td colSpan={selectMode ? 9 : 8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <BookOpen className="w-12 h-12 text-slate-300" />
                          <p className="text-slate-600 font-extrabold text-sm">No books found matching this filter</p>
                          <p className="text-xs text-slate-400">
                            {search || categoryFilter || statusFilter
                              ? "Try adjusting your search query, status, or category"
                              : "Start by adding your first book to the catalog"}
                          </p>
                          {(search || categoryFilter || statusFilter) && (
                            <Button onClick={clearFilters} variant="outline" size="sm" className="rounded-xl mt-1">
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedBooks.map((book, index) => {
                      const statusInfo = statusConfig[book.status] || statusConfig.AVAILABLE;
                      const StatusIcon = statusInfo.icon;
                      const barcodeVal = book.barcode || book.id.slice(0, 8).toUpperCase();
                      const isSelected = bulkSelected.has(book.id);
                      const locLabel = getLocationLabel(book);
                      const totalCopies = Math.max(book.totalCopies || 1, 1);
                      const availableCopies = book.availableCopies ?? (book.status === "AVAILABLE" ? 1 : 0);
                      const stockRatio = Math.min(Math.max((availableCopies / totalCopies) * 100, 0), 100);

                      return (
                        <motion.tr
                          key={book.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.015, 0.3) }}
                          className={`group hover:bg-emerald-50/40 transition-colors ${
                            isSelected ? "bg-amber-50/60" : ""
                          }`}
                        >
                          {selectMode && (
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBulkSelect(book.id)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                            </td>
                          )}

                          {/* Cover Thumbnail */}
                          <td className="px-3.5 py-2.5">
                            <div
                              onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                              className="w-9 h-13 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer hover:opacity-85 shadow-xs flex items-center justify-center"
                            >
                              {book.coverImage ? (
                                <img
                                  src={book.coverImage}
                                  alt={`Cover of ${book.title}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=10b981&color=fff&size=80`;
                                  }}
                                />
                              ) : (
                                <BookOpen className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </td>

                          {/* Barcode & 1-Click Copy */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div
                                onClick={() => setSingleBarcodeBook(book)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer group/bc"
                                title="Click to view & print barcode sticker"
                              >
                                <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                                  {barcodeVal}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => copyBarcode(barcodeVal)}
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Copy barcode to clipboard"
                              >
                                {copiedBarcode === barcodeVal ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setSingleBarcodeBook(book)}
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Print Barcode Sticker"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Title & Author */}
                          <td className="px-4 py-2.5">
                            <div className="max-w-xs">
                              <p
                                onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                                className="font-bold text-slate-900 hover:text-emerald-800 transition-colors line-clamp-1 cursor-pointer"
                                title={book.title}
                              >
                                {book.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-slate-500 truncate">
                                  {book.author || "—"}
                                </span>
                                {book.isbn && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                    {book.isbn}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                              {book.category}
                            </span>
                          </td>

                          {/* Location Coordinates */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {book.locationColor && (
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${colorConfig[book.locationColor] || "bg-slate-300"}`}
                                  title={`Color: ${book.locationColor}`}
                                />
                              )}
                              <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {locLabel}
                              </span>
                            </div>
                          </td>

                          {/* Stock Gauge */}
                          <td className="px-4 py-2.5">
                            <div className="w-28 space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-mono font-bold text-slate-800">
                                  {availableCopies}/{totalCopies}
                                </span>
                                <span className={`font-semibold ${availableCopies > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                  {availableCopies > 0 ? "In Stock" : "Depleted"}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    availableCopies === 0
                                      ? "bg-rose-500"
                                      : stockRatio < 50
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${stockRatio}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Circulation Status */}
                          <td className="px-4 py-2.5">
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                              {book.currentBorrower && (
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                                  {book.currentBorrower}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Operations */}
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick Issue Direct Link */}
                              <Link
                                href={`/admin/library/checkout?bookBarcode=${encodeURIComponent(barcodeVal)}`}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors cursor-pointer"
                                title="Direct issue volume at checkout desk"
                              >
                                <span>Issue</span>
                                <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                              </Link>

                              {/* Preview Details */}
                              <button
                                type="button"
                                onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => { setSelectedBook(book); setShowEditModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                                title="Edit Book"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => { setSelectedBook(book); setShowDeleteModal(true); }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete Book"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Modals */}
      <AddBookModal open={showAddModal} onOpenChange={setShowAddModal} onCreated={() => fetchBooks()} existingCategories={categories.map(c => c.name)} />
      <EditBookModal book={selectedBook} open={showEditModal} onOpenChange={setShowEditModal} onUpdated={() => fetchBooks()} existingCategories={categories.map(c => c.name)} />
      <BookDetailModal book={selectedBook} open={showDetailModal} onOpenChange={setShowDetailModal} />
      <DeleteBookModal book={selectedBook} open={showDeleteModal} onOpenChange={setShowDeleteModal} onDeleted={() => fetchBooks()} />
      
      {/* Single Barcode Sticker Modal */}
      <SingleBarcodeStickerModal
        book={singleBarcodeBook}
        open={!!singleBarcodeBook}
        onOpenChange={(open) => {
          if (!open) setSingleBarcodeBook(null);
        }}
      />

      {/* Scan Barcode Modal with Fast Hardware Scanner Catch */}
      <BookScanModal
        open={showScanModal}
        initialBarcode={scanModalBarcode}
        onOpenChange={(isOpen) => {
          setShowScanModal(isOpen);
          if (!isOpen) setScanModalBarcode("");
        }}
        onBookIssued={() => fetchBooks()}
      />

      {/* Print Barcode Labels Modal */}
      <PrintBarcodeLabels
        open={showPrintLabelsModal}
        onOpenChange={setShowPrintLabelsModal}
        books={books}
      />
    </div>
  );
}
