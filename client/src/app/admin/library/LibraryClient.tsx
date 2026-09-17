"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Plus,
  Barcode,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  BookMarked,
  BookX,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  RotateCcw,
  CheckCircle2,
  Layers,
  Library,
  Scan,
  FileText,
  SlidersHorizontal,
  Loader2,
  Printer,
  Upload,
  ImageIcon,
  Download,
  CheckSquare,
  Square,
  Keyboard,
  History,
  Clock,
  User,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalTrigger } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import PrintBarcodeLabels from "@/components/admin/PrintBarcodeLabels";
import BarcodeDisplay from "@/components/admin/BarcodeDisplay";
import BookScanModal from "@/components/admin/BookScanModal";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import Link from "next/link";

// ── Types ──
interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
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
          setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 500); }, 500);
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

          {/* Book Name / Title */}
          <div>
            <label htmlFor="add-title" className="block text-sm font-medium text-gray-700 mb-1">
              Name of the Book <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="add-title"
              name="addTitle"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Enter book title"
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
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
              <div className="col-span-2">
                <span className="text-gray-500">Barcode:</span>
                {book.barcode ? (
                  <div className="mt-1 bg-white border border-gray-100 rounded-xl p-3 flex flex-col items-center">
                    <BarcodeDisplay value={book.barcode} scale="md" showText={true} />
                  </div>
                ) : (
                  <span className="font-medium font-mono ml-1">—</span>
                )}
              </div>
              <div><span className="text-gray-500">Category:</span> <span className="font-medium">{book.category}</span></div>
              <div><span className="text-gray-500">Copies:</span> <span className="font-medium">{book.availableCopies}/{book.totalCopies} available</span></div>
              <div><span className="text-gray-500">Rack:</span> <span className="font-medium">{book.rackNumber || "—"}</span></div>
              <div><span className="text-gray-500">Shelf:</span> <span className="font-medium">{book.shelfNumber || "—"}</span></div>
              {book.locationColor && (
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-gray-500">Spine Label:</span>
                  <div className={`w-4 h-4 rounded ${colorConfig[book.locationColor] || "bg-gray-200"}`} />
                  <span className="font-medium">{book.locationColor}</span>
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

interface InitialData {
  books: LibraryBook[];
  categories: Category[];
  stats: { total: number; available: number; borrowed: number; restock: number };
}

// ── Main Page (Client Component) ──
export default function LibraryClient({ initialData }: { initialData?: InitialData }) {
  const [books, setBooks] = useState<LibraryBook[]>(initialData?.books || []);
  const [categories, setCategories] = useState<Category[]>(initialData?.categories || []);
  const [loading, setLoading] = useState(!initialData);
  const [stats, setStats] = useState(initialData?.stats || { total: 0, available: 0, borrowed: 0, restock: 0 });
  
  // Search & filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showPrintLabelsModal, setShowPrintLabelsModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        setCategories(data.categories || []);
        
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
        hubTitle="Library & Circulation"
        hubDescription="Book catalog, smart color-coded shelves, circulation desk, and overdue tracking."
        tabs={[
          { label: "Book Catalog", href: "/admin/library", icon: BookOpen },
          { label: "Shelves & Racks", href: "/admin/library/shelves", icon: Layers },
          { label: "Quick Checkout", href: "/admin/library/checkout", icon: ArrowRight },
          { label: "Overdue Monitor", href: "/admin/library/overdue", icon: Clock },
          { label: "Inventory Auditor", href: "/admin/library/auditor", icon: ShieldCheck },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="fatimi-header-banner">
          <div className="absolute top-0 left-0 w-32 h-32 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent">
                <Library className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Library System</h1>
                <p className="text-emerald-100 text-sm mt-1">Master Grid &middot; Item Management &middot; Circulation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/library/checkout">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
                  <ArrowRight className="w-4 h-4 mr-1" /> Checkout / Return
                </Button>
              </Link>
              <Link href="/admin/library/auditor">
                <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <Scan className="w-4 h-4 mr-1" /> Shelf Auditor
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setShowPrintLabelsModal(true)}>
                <Printer className="w-4 h-4 mr-1" /> Print Labels
              </Button>
              <button
                onClick={() => setSelectMode((p) => { if (p) setBulkSelected(new Set()); return !p; })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectMode
                    ? "bg-amber-400 text-amber-900 shadow-md"
                    : "border border-white/20 text-white hover:bg-white/10"
                }`}
                title="Toggle bulk selection (Ctrl+B)"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1 inline" />
                Bulk
              </button>
              <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
              <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => setShowScanModal(true)}>
                <Scan className="w-4 h-4 mr-1" /> Scan
              </Button>
              <Button size="sm" className="fatimi-gold-accent text-white hover:opacity-90 shadow-lg" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Book
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Library} label="Total Books" value={stats.total} color="text-emerald-700" />
        <StatCard icon={CheckCircle2} label="On Shelf" value={stats.available} sub={`${stats.total > 0 ? Math.round((stats.available / stats.total) * 100) : 0}% of collection`} color="text-emerald-700" />
        <Link href="/admin/library/overdue" className="group">
          <Card className="fatimi-card group-hover:shadow-md transition-all group-hover:border-red-200">
            <div className="fatimi-card-header" style={{ background: "linear-gradient(90deg, #dc2626, #fca5a5)" }} />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Overdue Books
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.borrowed > 0 ? "Check →" : "0"}</div>
              <p className="text-xs text-gray-500 mt-1">Click to view overdue report</p>
            </CardContent>
          </Card>
        </Link>
        <StatCard icon={RotateCcw} label="In Restock Queue" value={stats.restock} color="text-blue-600" />
      </motion.div>

      {/* Search & Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="fatimi-card mb-6">
          <div className="fatimi-card-header" />
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <label htmlFor="search-books" className="sr-only">Search books</label>
                <input
                  type="text"
                  id="search-books"
                  name="searchBooks"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by title, author, barcode, ISBN, or rack..."
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-gray-50/50"
                />
                {search && (
                  <button onClick={() => { setSearch(""); fetchBooks("", categoryFilter, statusFilter); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle */}
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="shrink-0">
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                Filters
                {(categoryFilter || statusFilter) && (
                  <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </Button>

              {/* Refresh */}
              <Button variant="outline" size="sm" onClick={() => fetchBooks()} className="shrink-0">
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Expandable Filter Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100 mt-4">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Category:</span>
                      <label htmlFor="filter-category" className="sr-only">Filter by category</label>
                      <select id="filter-category" name="filterCategory" value={categoryFilter} onChange={(e) => handleFilterChange("category", e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                        <option value="">All Categories</option>
                        {categories.map((cat) => (
                          <option key={cat.name} value={cat.name}>{cat.name} ({cat.count})</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Status:</span>
                      <label htmlFor="filter-status" className="sr-only">Filter by status</label>
                      <select id="filter-status" name="filterStatus" value={statusFilter} onChange={(e) => handleFilterChange("status", e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                        <option value="">All Status</option>
                        <option value="AVAILABLE">On Shelf</option>
                        <option value="BORROWED">Issued</option>
                        <option value="RESTOCK_QUEUE">In Sorting</option>
                        <option value="DAMAGED">Damaged</option>
                        <option value="LOST">Lost</option>
                      </select>
                    </div>

                    {/* Clear Filters */}
                    {(categoryFilter || statusFilter) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 text-xs h-auto py-1">
                        <X className="w-3 h-3 mr-1" />
                        Clear filters
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Master Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="fatimi-card">
          <div className="fatimi-card-header" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-emerald-100/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Cover</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title & Author</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Borrower</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" style={{ width: `${60 + Math.random() * 30}%` }} /></td>
                  ))}
                    </tr>
                  ))
                ) : books.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <BookOpen className="w-12 h-12 text-gray-400" />
                        <p className="text-gray-500 font-medium">No books found</p>
                        <p className="text-sm text-gray-400">
                          {search || categoryFilter || statusFilter ? "Try adjusting your search or filters" : "Start by adding your first book to the library"}
                        </p>
                        {!search && !categoryFilter && !statusFilter && (
                          <Button onClick={() => setShowAddModal(true)} variant="admin" size="sm">
                            <Plus className="w-4 h-4 mr-1" /> Add Your First Book
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  books.map((book, index) => {
                    const statusInfo = statusConfig[book.status] || statusConfig.AVAILABLE;
                    const StatusIcon = statusInfo.icon;
                    return (
                      <motion.tr
                        key={book.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="group hover:bg-emerald-50/30 transition-colors cursor-pointer"
                        onClick={() => { setSelectedBook(book); setShowDetailModal(true); }}
                      >
                        {/* Cover Image Thumbnail */}
                        <td className="px-4 py-3">
                          <div className="w-10 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                            {book.coverImage ? (
                              <img
                                src={book.coverImage}
                                alt={`Cover of ${book.title}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=6366f1&color=fff&size=80`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {book.barcode ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <BarcodeDisplay value={book.barcode} scale="sm" showText={false} className="-ml-1" />
                              <span className="font-mono text-[9px] text-gray-500 font-semibold tracking-wider">
                                {book.barcode}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                              {book.id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {book.locationColor && (
                              <div className={`w-3 h-8 rounded-sm shrink-0 ${colorConfig[book.locationColor] || "bg-gray-200"}`} title={`Color: ${book.locationColor}`} />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">{book.title}</p>
                              <p className="text-xs text-gray-500">{book.author || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{book.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-600">{getLocationLabel(book)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{book.currentBorrower || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setSelectedBook(book); setShowEditModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedBook(book); setShowDeleteModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Modals */}
      <AddBookModal open={showAddModal} onOpenChange={setShowAddModal} onCreated={() => fetchBooks()} existingCategories={categories.map(c => c.name)} />
      <EditBookModal book={selectedBook} open={showEditModal} onOpenChange={setShowEditModal} onUpdated={() => fetchBooks()} existingCategories={categories.map(c => c.name)} />
      <BookDetailModal book={selectedBook} open={showDetailModal} onOpenChange={setShowDetailModal} />
      <DeleteBookModal book={selectedBook} open={showDeleteModal} onOpenChange={setShowDeleteModal} onDeleted={() => fetchBooks()} />
      
      {/* Scan Barcode Modal */}
      <BookScanModal
        open={showScanModal}
        onOpenChange={setShowScanModal}
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
