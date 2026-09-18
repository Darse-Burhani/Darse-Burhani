"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Search,
  Edit3,
  Trash2,
  Move,
  ChevronRight,
  AlertTriangle,
  Loader2,
  X,
  Palette,
  RefreshCw,
  Library,
  ArrowRight,
  LayoutGrid,
  Rotate3d,
  Monitor,
  Copy,
  Check,
  BookOpen,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import Link from "next/link";

const LibraryShelf360 = lazy(() => import("@/components/admin/LibraryShelf360"));

// ── Types ──
interface ShelfData {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  totalBooks: number;
  availableBooks: number;
  label: string;
  categories: { name: string; count: number }[];
  borrowedBooks: number;
  books: { title: string; author: string | null; coverImage: string | null; status: string; barcode: string | null }[];
}

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

const colorBorderConfig: Record<string, string> = {
  Red: "border-red-400",
  Blue: "border-blue-400",
  Green: "border-green-400",
  Yellow: "border-yellow-400",
  Orange: "border-orange-400",
  Purple: "border-purple-400",
  Pink: "border-pink-400",
  "Light Blue": "border-sky-400",
  White: "border-gray-300",
};

const colorBgConfig: Record<string, string> = {
  Red: "bg-red-50",
  Blue: "bg-blue-50",
  Green: "bg-green-50",
  Yellow: "bg-yellow-50",
  Orange: "bg-orange-50",
  Purple: "bg-purple-50",
  Pink: "bg-pink-50",
  "Light Blue": "bg-sky-50",
  White: "bg-gray-50",
};

const colorTextConfig: Record<string, string> = {
  Red: "text-red-700",
  Blue: "text-blue-700",
  Green: "text-green-700",
  Yellow: "text-yellow-700",
  Orange: "text-orange-700",
  Purple: "text-purple-700",
  Pink: "text-pink-700",
  "Light Blue": "text-sky-700",
  White: "text-gray-700",
};

// ── Shelf Card Component ──
function ShelfCard({
  shelf,
  onEdit,
  onDelete,
  onMove,
}: {
  shelf: ShelfData;
  onEdit: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const availabilityPct = shelf.totalBooks > 0 ? (shelf.availableBooks / shelf.totalBooks) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white rounded-xl border-2 border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Color strip */}
      {shelf.locationColor && (
        <div
          className={`absolute top-0 left-0 right-0 h-2 ${colorConfig[shelf.locationColor] || "bg-gray-300"}`}
        />
      )}

      <div className="p-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              shelf.locationColor
                ? colorBgConfig[shelf.locationColor] || "bg-gray-100"
                : "bg-emerald-100"
            }`}>
              <Layers className={`w-5 h-5 ${
                shelf.locationColor
                  ? colorTextConfig[shelf.locationColor] || "text-gray-600"
                  : "text-emerald-600"
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-base text-gray-900">{shelf.label}</span>
                {shelf.locationColor && (
                  <div className={`w-3 h-3 rounded-sm ${colorConfig[shelf.locationColor] || "bg-gray-300"}`} />
                )}
              </div>
              <p className="text-xs text-gray-500">{shelf.totalBooks} book{shelf.totalBooks !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Availability indicator */}
          <div className="flex flex-col items-end">
            <span className={`text-sm font-bold ${
              availabilityPct > 50 ? "text-emerald-700" : availabilityPct > 0 ? "text-amber-700" : "text-red-600"
            }`}>
              {shelf.availableBooks}
            </span>
            <span className="text-[10px] text-gray-400">avail.</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              availabilityPct > 50 ? "bg-emerald-500" : availabilityPct > 0 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${availabilityPct}%` }}
          />
        </div>

        {/* Categories */}
        {shelf.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {shelf.categories.slice(0, 3).map((cat) => (
              <span
                key={cat.name}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium"
              >
                {cat.name} ({cat.count})
              </span>
            ))}
            {shelf.categories.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                +{shelf.categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={onMove}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Move className="w-3.5 h-3.5" />
            Move
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Edit Shelf Modal ──
function EditShelfModal({
  shelf,
  open,
  onOpenChange,
  onUpdated,
  colorOptions,
}: {
  shelf: ShelfData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  colorOptions: string[];
}) {
  const [rackNumber, setRackNumber] = useState("");
  const [shelfNumber, setShelfNumber] = useState("");
  const [locationColor, setLocationColor] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shelf) {
      setRackNumber(shelf.rackNumber || "");
      setShelfNumber(shelf.shelfNumber || "");
      setLocationColor(shelf.locationColor || "");
    }
  }, [shelf]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackNumber.trim() || !shelf) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/shelves", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldRackNumber: shelf.rackNumber,
          oldShelfNumber: shelf.shelfNumber,
          newRackNumber: rackNumber.trim(),
          newShelfNumber: shelfNumber.trim() || null,
          locationColor: locationColor || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Shelf Updated", description: data.message, variant: "success" });
        onOpenChange(false);
        onUpdated();
      } else {
        toast({ title: "Error", description: data.error || "Update failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update shelf", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-emerald-600" />
            Edit Shelf: {shelf?.label}
          </ModalTitle>
          <ModalDescription>
            Update the rack/shelf label and color. All books on this shelf will be updated.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rackNumber" className="block text-sm font-medium text-gray-700 mb-1">Rack</label>
              <input
                type="text"
                id="rackNumber"
                name="rackNumber"
                value={rackNumber}
                onChange={(e) => setRackNumber(e.target.value)}
                placeholder="e.g., R1"
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="shelfNumber" className="block text-sm font-medium text-gray-700 mb-1">Shelf</label>
              <input
                type="text"
                id="shelfNumber"
                name="shelfNumber"
                value={shelfNumber}
                onChange={(e) => setShelfNumber(e.target.value)}
                placeholder="e.g., A"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Color picker */}
          <fieldset className="border-0 p-0 m-0">
            <legend className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Label Color
            </legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocationColor("")}
                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                  !locationColor ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setLocationColor(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    locationColor === color
                      ? `${colorBorderConfig[color] || "border-emerald-500"} ring-2 ring-emerald-200 scale-110`
                      : "border-gray-200 hover:scale-105"
                  } ${colorConfig[color] || "bg-gray-100"}`}
                  title={color}
                />
              ))}
            </div>
          </fieldset>

          {shelf && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              {shelf.totalBooks} book{shelf.totalBooks !== 1 ? "s" : ""} will be updated
            </p>
          )}

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !rackNumber.trim()} variant="admin">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ── Move Books Modal ──
function MoveBooksModal({
  shelf,
  open,
  onOpenChange,
  onUpdated,
}: {
  shelf: ShelfData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [toRack, setToRack] = useState("");
  const [toShelf, setToShelf] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toRack.trim() || !shelf) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/shelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRack: shelf.rackNumber,
          fromShelf: shelf.shelfNumber,
          toRack: toRack.trim(),
          toShelf: toShelf.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Books Moved", description: data.message, variant: "success" });
        onOpenChange(false);
        onUpdated();
      } else {
        toast({ title: "Error", description: data.error || "Move failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to move books", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Move className="w-5 h-5 text-blue-600" />
            Move Books from {shelf?.label}
          </ModalTitle>
          <ModalDescription>
            Move all books from this shelf to a different rack/shelf location.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">From</p>
            <p className="font-mono font-bold text-gray-900">{shelf?.label}</p>
            <p className="text-xs text-gray-400">{shelf?.totalBooks} book{shelf?.totalBooks !== 1 ? "s" : ""}</p>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>

          {/* Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="toRack" className="block text-sm font-medium text-gray-700 mb-1">To Rack *</label>
              <input
                type="text"
                id="toRack"
                name="toRack"
                value={toRack}
                onChange={(e) => setToRack(e.target.value)}
                placeholder="e.g., R3"
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="toShelf" className="block text-sm font-medium text-gray-700 mb-1">To Shelf</label>
              <input
                type="text"
                id="toShelf"
                name="toShelf"
                value={toShelf}
                onChange={(e) => setToShelf(e.target.value)}
                placeholder="e.g., C"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {shelf && (
            <p className="text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2 text-blue-700">
              {shelf.totalBooks} book{shelf.totalBooks !== 1 ? "s" : ""} will be moved
            </p>
          )}

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !toRack.trim()} variant="admin">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Move className="w-4 h-4 mr-1" />}
              Move All Books
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

// ── Main Shelves Page ──
export default function AdminShelvesPage() {
  const [shelves, setShelves] = useState<ShelfData[]>([]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalShelves: 0, totalBooks: 0, totalAvailable: 0, unassignedBooks: 0 });
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<"360" | "grid">("360");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [editingShelf, setEditingShelf] = useState<ShelfData | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [movingShelf, setMovingShelf] = useState<ShelfData | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ShelfData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tvModalOpen, setTvModalOpen] = useState(false);
  const [tvCopied, setTvCopied] = useState(false);

  // ── Load Shelves ──
  const loadShelves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/shelves");
      const data = await res.json();
      if (data.success) {
        setShelves(data.data);
        setColorOptions(data.colorOptions || []);
        setStats(data.stats);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load shelves", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  // ── Filtered shelves ──
  const filteredShelves = shelves.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.label.toLowerCase().includes(q) ||
      s.rackNumber?.toLowerCase().includes(q) ||
      s.shelfNumber?.toLowerCase().includes(q) ||
      s.categories.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  // ── Delete/Clear Shelf ──
  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/library/shelves?rack=${encodeURIComponent(confirmDelete.rackNumber || "")}&shelf=${encodeURIComponent(confirmDelete.shelfNumber || "")}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        toast({ title: "Shelf Cleared", description: data.message, variant: "success" });
        setConfirmDelete(null);
        loadShelves();
      } else {
        toast({ title: "Error", description: data.error || "Failed to clear shelf", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to clear shelf", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Group by rack ──
  const groupedShelves = filteredShelves.reduce<Record<string, ShelfData[]>>((acc, s) => {
    const rack = s.rackNumber || "Unlabeled";
    if (!acc[rack]) acc[rack] = [];
    acc[rack].push(s);
    return acc;
  }, {});

  const rackKeys = Object.keys(groupedShelves).sort();

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

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/admin/library" className="hover:text-emerald-700 transition-colors">Library</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-900 font-medium">Shelf Configuration</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Layers className="w-7 h-7 text-emerald-600" />
              Shelf Layout Management
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setViewMode("360")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "360"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Rotate3d className="w-3.5 h-3.5" />
                360° View
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid View
              </button>
            </div>
            <Button variant="outline" onClick={loadShelves} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="admin" onClick={() => setTvModalOpen(true)} className="gap-2">
              <Monitor className="w-4 h-4" />
              Publish to TV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700">{stats.totalShelves}</p>
            <p className="text-xs text-emerald-700">Shelving Units</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
            <p className="text-2xl font-bold text-blue-700">{stats.totalBooks}</p>
            <p className="text-xs text-blue-600">Total Books</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <p className="text-2xl font-bold text-green-700">{stats.totalAvailable}</p>
            <p className="text-xs text-green-700">Available</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <p className="text-2xl font-bold text-amber-700">{stats.unassignedBooks}</p>
            <p className="text-xs text-amber-600">Unassigned</p>
          </div>
        </div>
      </motion.div>

      {/* Search (grid mode) */}
      {viewMode === "grid" && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <label htmlFor="search-shelves" className="sr-only">Search shelves</label>
          <input
            type="text"
            id="search-shelves"
            name="search-shelves"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shelves by rack, shelf, or category..."
            className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
      )}

      {/* 360° Shelf View */}
      {viewMode === "360" ? (
        loading ? (
          <div className="h-[540px] sm:h-[600px] rounded-2xl bg-gray-100 animate-pulse" />
        ) : (
          <Suspense fallback={<div className="h-[540px] sm:h-[600px] rounded-2xl bg-gray-100 animate-pulse" />}>
            <LibraryShelf360
              shelves={shelves}
              onEdit={(shelf: any) => { setEditingShelf(shelf); setEditModalOpen(true); }}
              onMove={(shelf: any) => { setMovingShelf(shelf); setMoveModalOpen(true); }}
              onClear={(shelf: any) => setConfirmDelete(shelf)}
            />
          </Suspense>
        )
      ) : loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-5 w-32 bg-gray-100 rounded-lg animate-pulse mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-44 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredShelves.length === 0 ? (
        <div className="text-center py-16">
          <Library className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {searchQuery ? "No shelves match your search" : "No shelves configured"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery
              ? "Try a different search term"
              : "Add books with rack/shelf numbers to see them here"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {rackKeys.map((rack) => (
            <motion.div key={rack} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Rack header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-emerald-700" />
                </div>
                <h2 className="text-base font-bold text-gray-800 uppercase tracking-wider">{rack}</h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{groupedShelves[rack].length} shelf{groupedShelves[rack].length !== 1 ? "ves" : ""}</span>
              </div>

              {/* Shelf cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedShelves[rack].map((shelf) => (
                  <ShelfCard
                    key={shelf.label}
                    shelf={shelf}
                    onEdit={() => { setEditingShelf(shelf); setEditModalOpen(true); }}
                    onDelete={() => setConfirmDelete(shelf)}
                    onMove={() => { setMovingShelf(shelf); setMoveModalOpen(true); }}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Shelf Modal */}
      <EditShelfModal
        shelf={editingShelf}
        open={editModalOpen}
        onOpenChange={(open) => { setEditModalOpen(open); if (!open) setEditingShelf(null); }}
        onUpdated={loadShelves}
        colorOptions={colorOptions}
      />

      {/* Move Books Modal */}
      <MoveBooksModal
        shelf={movingShelf}
        open={moveModalOpen}
        onOpenChange={(open) => { setMoveModalOpen(open); if (!open) setMovingShelf(null); }}
        onUpdated={loadShelves}
      />

      {/* TV Publish Modal */}
      <Modal open={tvModalOpen} onOpenChange={(o) => { setTvModalOpen(o); if (!o) setTvCopied(false); }}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-emerald-600" />
              Publish Shelves to TV
            </ModalTitle>
            <ModalDescription>
              Open this link in a browser on any TV (Chromecast, Smart TV, or a cast tab
              from Chrome). It shows a live, auto-rotating view of the library shelves.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            {/* TV URL */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-2">TV display URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-emerald-700 break-all bg-white border border-gray-200 rounded-lg px-3 py-2">
                  {`${window.location.origin}/library/tv`}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/library/tv`);
                    setTvCopied(true);
                    setTimeout(() => setTvCopied(false), 2000);
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  {tvCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {tvCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* QR-style helper */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1.5">How to put it on your TV</p>
              <ul className="space-y-1.5 text-emerald-700 text-[13px]">
                <li>· <b>Chromecast:</b> open this URL in Chrome on your computer → Cast → select the TV.</li>
                <li>· <b>Smart TV / Android box:</b> open the TV browser and enter the address, or scan a QR code of this URL.</li>
                <li>· <b>Fire TV / Apple TV:</b> cast the tab from Chrome or Safari.</li>
                <li>· The display auto-rotates shelves and refreshes live data every 60s.</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This link is public — anyone on the network can view the shelf layout without logging in.
            </div>
          </div>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setTvModalOpen(false)}>Close</Button>
            <Button type="button" variant="admin" onClick={() => window.open(`${window.location.origin}/library/tv`, "_blank")}>
              <Monitor className="w-4 h-4 mr-1" /> Preview Fullscreen
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Clear Shelf: {confirmDelete?.label}
            </ModalTitle>
            <ModalDescription>
              This will remove the rack, shelf, and color assignments from all books on this shelf.
              Books will become unassigned but will not be deleted.
            </ModalDescription>
          </ModalHeader>
          {confirmDelete && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-sm">
              <p className="font-medium text-red-800">{confirmDelete.totalBooks} book{confirmDelete.totalBooks !== 1 ? "s" : ""} will be affected</p>
              <p className="text-xs text-red-600 mt-1">This action can be undone by reassigning shelves individually.</p>
            </div>
          )}
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button type="button" disabled={deleting} variant="destructive" onClick={handleDeleteConfirm}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Clear Shelf Assignments
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Legend (grid mode) */}
      {viewMode === "grid" && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 bg-gray-50 rounded-xl px-6 py-3 border border-gray-100"
      >
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          Good stock (&gt;50% avail.)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          Low stock (&lt;50% avail.)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          Empty/Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "var(--color-swatch, #ccc)" }} />
          Color-coded label
        </span>
      </motion.div>
      )}
    </div>
  );
}
