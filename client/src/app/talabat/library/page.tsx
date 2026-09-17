"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  X,
  Compass,
  TrendingUp,
  Layers,
  Library,

  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MapPin,
  Sparkles,
  Loader2,
  BookMarked,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

// ── Types ──
interface ShelfInfo {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  totalBooks: number;
  availableBooks: number;
  label: string;
}

interface BookInfo {
  id: string;
  title: string;
  author: string | null;
  category: string;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  coverImage: string | null;
  status: string;
  totalCopies: number;
  availableCopies: number;
  notes: string | null;
  location: string;
}

interface BookPick {
  id: string;
  title: string;
  author: string | null;
  category: string;
  coverImage: string | null;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  status: string;
  totalCopies: number;
  availableCopies: number;
  location: string;
}

// ── Color Map ──
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
  Red: "border-red-300",
  Blue: "border-blue-300",
  Green: "border-green-300",
  Yellow: "border-yellow-300",
  Orange: "border-orange-300",
  Purple: "border-purple-300",
  Pink: "border-pink-300",
  "Light Blue": "border-sky-300",
  White: "border-gray-300",
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

const categoryColors: Record<string, string> = {
  General: "from-blue-500 to-blue-600",
  Fiction: "from-purple-500 to-pink-600",
  "Non-Fiction": "from-teal-500 to-emerald-600",
  Science: "from-cyan-500 to-blue-600",
  History: "from-amber-500 to-orange-600",
  Religion: "from-emerald-500 to-green-600",
  Mathematics: "from-violet-500 to-purple-600",
  Language: "from-rose-500 to-pink-600",
  Arts: "from-fuchsia-500 to-purple-600",
  Biography: "from-indigo-500 to-blue-600",
  Reference: "from-gray-500 to-slate-600",
  Children: "from-yellow-400 to-orange-500",
  "Self-Help": "from-lime-500 to-green-600",
  Technology: "from-sky-500 to-cyan-600",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || "from-gray-400 to-gray-500";
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  AVAILABLE: { label: "Available", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  BORROWED: { label: "Borrowed", color: "text-amber-600 bg-amber-50 border-amber-200", icon: BookMarked },
  RESTOCK_QUEUE: { label: "Restocking", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Clock },
  DAMAGED: { label: "Damaged", color: "text-red-600 bg-red-50 border-red-200", icon: AlertTriangle },
  LOST: { label: "Lost", color: "text-gray-600 bg-gray-50 border-gray-200", icon: AlertTriangle },
};

// ── Book Detail Modal ──
function BookDetailModal({ book, open, onOpenChange }: {
  book: (BookInfo | BookPick) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!book) return null;

  const statusCfg = statusConfig[book.status] || statusConfig.AVAILABLE;
  const StatusIcon = statusCfg.icon;
  const rack = book.rackNumber || "?";
  const shelf = book.shelfNumber || "";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Color top bar */}
        <div className={`h-2 w-full bg-gradient-to-r ${getCategoryColor(book.category)}`} />

        <div className="grid sm:grid-cols-5 gap-0">
          {/* Left: Cover Image */}
          <div className="sm:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex flex-col items-center justify-center min-h-[200px]">
            <div className="w-full max-w-[160px] aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-lg border border-gray-200">
              {book.coverImage ? (
                <img
                  src={book.coverImage}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=6366f1&color=fff&size=160&font-size=0.33`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50 gap-2">
                  <BookOpen className="w-12 h-12 text-emerald-400" />
                  <span className="text-[10px] text-emerald-600 font-medium">No Cover</span>
                </div>
              )}
            </div>

            {/* Barcode */}
            {book.barcode && (
              <div className="mt-3 text-center">
                <p className="text-[10px] text-gray-400 font-mono tracking-wider bg-white px-3 py-1 rounded-lg border border-gray-200">
                  {book.barcode}
                </p>
              </div>
            )}
          </div>

          {/* Right: Book Details */}
          <div className="sm:col-span-3 p-6 space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{book.title}</h2>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] px-2 py-0.5 ${statusCfg.color}`}
                >
                  <StatusIcon className="w-2.5 h-2.5 mr-0.5 inline" />
                  {statusCfg.label}
                </Badge>
              </div>
              {book.author && (
                <p className="text-sm text-gray-600 mt-1">by <span className="font-medium text-gray-800">{book.author}</span></p>
              )}
            </div>

            {/* Category & Copies */}
            <div className="flex flex-wrap gap-2">
              <span className={`text-[11px] px-2.5 py-1 rounded-full text-white font-medium bg-gradient-to-r ${getCategoryColor(book.category)}`}>
                {book.category}
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                {book.availableCopies} / {book.totalCopies} available
              </span>
            </div>

            {/* Location Map */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Shelf Location</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Visual mini-map of the shelf */}
                <div className="flex items-center gap-2">
                  {/* Rack icon */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-14 rounded-lg bg-emerald-200 flex items-center justify-center border-2 border-emerald-400 shadow-sm">
                      <Layers className="w-5 h-5 text-emerald-700" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 mt-1">{rack}</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-5 h-0.5 bg-emerald-300" />
                    <ChevronRight className="w-4 h-4 text-emerald-400 -mt-1.5" />
                  </div>

                  {/* Shelf indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-14 rounded-lg flex items-center justify-center border-2 shadow-sm ${
                        book.locationColor
                          ? colorConfig[book.locationColor]
                            ? `${colorConfig[book.locationColor]} border-transparent`
                            : "bg-gray-200 border-gray-300"
                          : "bg-amber-100 border-amber-300"
                      }`}
                    >
                      <BookOpen className={`w-5 h-5 ${book.locationColor && colorConfig[book.locationColor] ? "text-white" : "text-amber-700"}`} />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-amber-700 mt-1">{shelf || "—"}</span>
                  </div>
                </div>

                {/* Location text */}
                <div className="text-xs text-gray-600">
                  <p className="font-semibold text-gray-800">Rack {rack}</p>
                  <p className="text-gray-500">{shelf ? `Shelf ${shelf}` : "No shelf assigned"}</p>
                  {book.locationColor && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-2 h-2 rounded-sm ${colorConfig[book.locationColor] || "bg-gray-300"}`} />
                      <span className="text-[10px] text-gray-400">{book.locationColor}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {"notes" in book && book.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{book.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {book.category} · {book.status === "AVAILABLE" ? "On Shelf" : book.status}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="font-mono">{book.location}</span>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

// ── Book Card ──
function BookCard({ book, onSelect }: { book: BookInfo | BookPick; onSelect?: (book: BookInfo | BookPick) => void }) {
  const statusCfg = statusConfig[book.status] || statusConfig.AVAILABLE;
  const StatusIcon = statusCfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      onClick={() => onSelect?.(book)}
      className="group relative bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
    >
      {/* Color top bar */}
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${getCategoryColor(book.category)}`}
      />

      <div className="p-3.5">
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
            {book.coverImage ? (
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(book.title)}&background=6366f1&color=fff&size=80&font-size=0.28`;
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50">
                <BookOpen className="w-6 h-6 text-emerald-400" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors">
              {book.title}
            </p>
            {book.author && (
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{book.author}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${statusCfg.color}`}
              >
                <StatusIcon className="w-2.5 h-2.5 mr-0.5 inline" />
                {statusCfg.label}
              </Badge>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                {book.category}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-400">
              <MapPin className="w-3 h-3" />
              <span className="font-mono">{book.location}</span>
              {book.locationColor && (
                <div className={`w-2 h-2 rounded-sm ${colorConfig[book.locationColor] || "bg-gray-300"} ml-0.5`} />
              )}
            </div>
            {"availableCopies" in book && book.availableCopies > 0 && (
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                {book.availableCopies} copy{book.availableCopies !== 1 ? "ies" : "y"} available
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Shelf Unit Component ──
function ShelfUnit({
  shelf,
  onClick,
  isActive,
  categoryMap,
}: {
  shelf: ShelfInfo;
  onClick: () => void;
  isActive: boolean;
  categoryMap: Record<string, string[]>;
}) {
  const rack = shelf.rackNumber || "";
  const categories = categoryMap[rack] || [];
  const availabilityPct = shelf.totalBooks > 0 ? (shelf.availableBooks / shelf.totalBooks) * 100 : 0;

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`group relative p-3 rounded-xl border-2 transition-all duration-200 text-left w-full ${
        isActive
          ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100/50"
          : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Color strip */}
      {shelf.locationColor && (
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-xl ${colorConfig[shelf.locationColor] || "bg-gray-300"}`}
        />
      )}

      <div className="flex items-center gap-2.5">
        {/* Rack icon with availability indicator */}
        <div className="relative">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isActive
                ? "bg-emerald-200 text-emerald-700"
                : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          {/* Availability dot */}
          <div
            className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
              availabilityPct > 50
                ? "bg-emerald-500"
                : availabilityPct > 0
                  ? "bg-amber-400"
                  : "bg-red-400"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-sm text-gray-900">
              {shelf.label}
            </span>
            {shelf.locationColor && (
              <span className={`text-[10px] font-medium ${colorTextConfig[shelf.locationColor] || "text-gray-500"}`}>
                {shelf.locationColor}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {shelf.totalBooks} book{shelf.totalBooks !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">
              {shelf.availableBooks} available
            </span>
          </div>
          {/* Category tags */}
          {categories.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium bg-gradient-to-r ${getCategoryColor(cat)}`}
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronRight
          className={`w-4 h-4 transition-transform duration-200 ${
            isActive ? "rotate-90 text-emerald-600" : "text-gray-400"
          }`}
        />
      </div>
    </motion.button>
  );
}

// ── Main Page ──
export default function TalabatLibraryPage() {
  const [shelves, setShelves] = useState<ShelfInfo[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});
  const [stats, setStats] = useState({ totalShelves: 0, totalBooks: 0, totalAvailable: 0 });
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [shelfBooks, setShelfBooks] = useState<BookInfo[]>([]);
  const [loadingShelf, setLoadingShelf] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Recommendations
  const [recommendations, setRecommendations] = useState<BookPick[]>([]);
  const [recommendStats, setRecommendStats] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showRecs, setShowRecs] = useState(false);

  // Book Detail Modal
  const [selectedBook, setSelectedBook] = useState<(BookInfo | BookPick) | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // ── Load Overview ──
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/talabat/library");
      const data = await res.json();
      if (data.success) {
        setShelves(data.data);
        setCategoryMap(data.categoryMap || {});
        setStats(data.stats);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load library", variant: "destructive" });
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ── Load Shelf Books ──
  const loadShelf = useCallback(async (label: string) => {
    setLoadingShelf(true);
    setSelectedShelf(label);
    setShowSearch(false);
    setShowRecs(false);
    try {
      const res = await fetch(`/api/talabat/library?shelf=${encodeURIComponent(label)}`);
      const data = await res.json();
      if (data.success) {
        setShelfBooks(data.data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load shelf", variant: "destructive" });
    } finally {
      setLoadingShelf(false);
    }
  }, []);

  // ── Search ──
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    setSearching(true);
    setShowSearch(true);
    setSelectedShelf(null);
    setShowRecs(false);
    try {
      const res = await fetch(`/api/talabat/library?search=${encodeURIComponent(query)}&all=true`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch {
      toast({ title: "Error", description: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // ── Load Recommendations ──
  const loadRecommendations = useCallback(async () => {
    setLoadingRecs(true);
    setShowRecs(true);
    setSelectedShelf(null);
    setShowSearch(false);
    try {
      const res = await fetch("/api/talabat/library?recommend=true");
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.data.picks);
        setRecommendStats(data.data.stats);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load recommendations", variant: "destructive" });
    } finally {
      setLoadingRecs(false);
    }
  }, []);

  // ── Group shelves by rack ──
  const groupedShelves = useMemo(() => {
    const groups: Record<string, ShelfInfo[]> = {};
    for (const shelf of shelves) {
      const rack = shelf.rackNumber || "Unlabeled";
      if (!groups[rack]) groups[rack] = [];
      groups[rack].push(shelf);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [shelves]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Hero Header ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 p-6 sm:p-8">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-[0.04]">
            <svg className="w-full h-full" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="libPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M20 0L40 20L20 40L0 20Z" fill="none" stroke="white" strokeWidth="0.5" />
                  <circle cx="20" cy="20" r="4" fill="none" stroke="white" strokeWidth="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#libPattern)" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Library className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Library Explorer
                </h1>
                <p className="text-emerald-100 text-sm mt-0.5">
                  360° view of every rack, shelf, and book
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadRecommendations}
                className="bg-white/15 text-white hover:bg-white/25 border border-white/20"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Discover
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/15">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalBooks}</p>
              <p className="text-xs text-emerald-100/80">Total Books</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalAvailable}</p>
              <p className="text-xs text-emerald-100/80">Available Now</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalShelves}</p>
              <p className="text-xs text-emerald-100/80">Shelving Units</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Search Bar ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <label htmlFor="search-books" className="sr-only">Search books</label>
          <input
            type="text"
            id="search-books"
            name="search-books"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search books by title, author, or category..."
            className="w-full rounded-xl border-2 border-gray-200 pl-12 pr-10 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSearch(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searching && (
            <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />
          )}
        </div>
      </motion.div>

      {/* ── Search Results Panel ── */}
      <AnimatePresence>
        {showSearch && searchQuery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Search className="w-4 h-4 text-emerald-600" />
                  Search Results ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No books found matching &quot;{searchQuery}&quot;</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">                      {searchResults.map((book) => (
                      <BookCard key={book.id} book={book} onSelect={(b) => { setSelectedBook(b); setDetailModalOpen(true); }} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recommendations Panel ── */}
      <AnimatePresence>
        {showRecs && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <Card className="fatimi-card border-amber-200">
              <div
                className="fatimi-card-header"
                style={{ background: "linear-gradient(90deg, #d4af37, #fbbf24, #d4af37)" }}
              />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <span>What to Choose Today</span>
                  {recommendStats && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      {recommendStats.availableNow} books available across {recommendStats.totalCategories} categories
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecs ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-44 bg-gray-100 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="text-center py-8">
                    <Compass className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No recommendations available right now</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {recommendations.map((book) => (
                      <BookCard key={book.id} book={book} onSelect={(b) => { setSelectedBook(b); setDetailModalOpen(true); }} />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center mt-4 gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> Curated picks
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> In stock
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content: Shelves Grid + Selected Shelf Books ── */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Floor Plan: Rack & Shelf Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                Floor Plan — Browse by Rack & Shelf
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : shelves.length === 0 ? (
                <div className="text-center py-12">
                  <Library className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Library is being set up</p>
                  <p className="text-sm text-gray-400 mt-1">No shelves configured yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedShelves.map(([rack, rackShelves]) => (
                    <div key={rack}>
                      {/* Rack header */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{rack}</h3>
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] text-gray-400">{rackShelves.length} shelf{rackShelves.length !== 1 ? "ves" : ""}</span>
                      </div>

                      {/* Shelves in this rack */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {rackShelves.map((shelf) => (
                          <ShelfUnit
                            key={shelf.label}
                            shelf={shelf}
                            onClick={() => loadShelf(shelf.label)}
                            isActive={selectedShelf === shelf.label}
                            categoryMap={categoryMap}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Selected Shelf Books */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2"
        >
          <AnimatePresence mode="wait">
            {selectedShelf ? (
              <motion.div
                key={selectedShelf}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="fatimi-card">
                  <div className="fatimi-card-header" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BookOpen className="w-4 h-5 text-emerald-600" />
                      <span className="font-mono">{selectedShelf}</span>
                      {!loadingShelf && (
                        <span className="text-xs font-normal text-gray-500">
                          {shelfBooks.length} book{shelfBooks.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingShelf ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
                        ))}
                      </div>
                    ) : shelfBooks.length === 0 ? (
                      <div className="text-center py-8">
                        <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">This shelf is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {shelfBooks.map((book) => (
                          <BookCard key={book.id} book={book} onSelect={(b) => { setSelectedBook(b); setDetailModalOpen(true); }} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="fatimi-card h-full">
                  <div className="fatimi-card-header" />
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                      <Compass className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">Explore the Library</h3>
                    <p className="text-sm text-gray-400 max-w-xs">
                      Click on a shelf from the floor plan to see which books are there, or use the search bar above
                    </p>
                    <div className="flex gap-3 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadRecommendations}
                        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Get Recommendations
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Book Detail Modal ── */}
      <BookDetailModal
        book={selectedBook}
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) setTimeout(() => setSelectedBook(null), 200);
        }}
      />

      {/* ── Bottom Legend ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 bg-gray-50/50 rounded-xl px-6 py-3 border border-gray-100"
      >
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          Well-stocked (&gt;50% available)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          Low stock (&lt;50% available)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          Borrowed
        </span>
      </motion.div>
    </div>
  );
}
