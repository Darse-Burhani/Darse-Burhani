"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scan,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Library,
  Layers,
  BookOpen,
  RotateCcw,
  RefreshCw,
  Barcode,
  ClipboardCheck,
  ChevronRight,
  Search,
  Volume2,
  Bell,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Clock, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

// ── Types ──
interface ShelfInfo {
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  count: number;
  label: string;
}

interface ExpectedBook {
  id: string;
  title: string;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  status: string;
  locationColor: string | null;
}

interface ScanResult {
  bookFound: boolean;
  isCorrectLocation: boolean;
  book: {
    id: string;
    title: string;
    author: string | null;
    barcode: string | null;
    expectedLocation: string;
    actualLocation: string;
    status: string;
    locationColor: string | null;
  };
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

// ── Main Auditor Page ──
export default function AuditorPage() {
  const [shelves, setShelves] = useState<ShelfInfo[]>([]);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [expectedBooks, setExpectedBooks] = useState<ExpectedBook[]>([]);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loadingShelves, setLoadingShelves] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0, total: 0 });
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch Shelves ──
  const fetchShelves = useCallback(async () => {
    setLoadingShelves(true);
    try {
      const res = await fetch("/api/admin/library/auditor");
      const data = await res.json();
      if (data.success) {
        setShelves(data.data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load shelves", variant: "destructive" });
    } finally {
      setLoadingShelves(false);
    }
  }, []);

  useEffect(() => {
    fetchShelves();
  }, [fetchShelves]);

  // ── Select Shelf ──
  const selectShelf = useCallback(async (label: string) => {
    setSelectedShelf(label);
    setScanResults([]);
    setStats({ correct: 0, incorrect: 0, total: 0 });
    setLoadingBooks(true);

    try {
      const res = await fetch(`/api/admin/library/auditor?rack=${encodeURIComponent(label)}`);
      const data = await res.json();
      if (data.success) {
        setExpectedBooks(data.data);
        toast({ title: "Shelf Selected", description: `Auditing ${label} (${data.data.length} books expected)`, variant: "success" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load shelf books", variant: "destructive" });
    } finally {
      setLoadingBooks(false);
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, []);

  // ── Back to Shelf Selection ──
  const backToShelves = () => {
    setSelectedShelf(null);
    setExpectedBooks([]);
    setScanResults([]);
    setStats({ correct: 0, incorrect: 0, total: 0 });
  };

  // ── Handle Scan ──
  const handleScan = useCallback(async () => {
    const barcode = scannedBarcode.trim();
    if (!barcode || !selectedShelf) return;

    setScannedBarcode("");
    setScanning(true);

    try {
      const [rackPart, shelfPart] = selectedShelf.split("-");
      
      const res = await fetch("/api/admin/library/auditor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          expectedRackNumber: rackPart,
          expectedShelfNumber: shelfPart || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const result = data.data;
        setScanResults((prev) => [result, ...prev]);
        
        if (result.isCorrectLocation) {
          setStats((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
          toast({ title: "✓ Correct Location", description: `"${result.book.title}" is in the right place`, variant: "success" });
        } else {
          setStats((prev) => ({ ...prev, incorrect: prev.incorrect + 1, total: prev.total + 1 }));
          toast({ 
            title: "✗ MISPLACED!", 
            description: `"${result.book.title}" belongs at ${result.book.expectedLocation} but found at ${result.book.actualLocation}`,
            variant: "destructive" 
          });
          // Trigger visual/audio alert for misfiled book
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        }
      } else if (!data.data?.bookFound) {
        toast({ title: "Unknown Book", description: "This barcode is not in the system", variant: "warning" });
      }
    } catch {
      toast({ title: "Scan Error", description: "Failed to verify book", variant: "destructive" });
    } finally {
      setScanning(false);
      barcodeInputRef.current?.focus();
    }
  }, [scannedBarcode, selectedShelf]);

  // ── Handle Enter Key ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  // ── Color for location ──
  const getLocationColor = (colorName: string | null): string => {
    if (!colorName) return "bg-gray-200";
    return colorConfig[colorName] || "bg-gray-200";
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

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="fatimi-header-banner">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-400/30">
                <Scan className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">Rapid Shelf Auditor</h1>
                <p className="text-emerald-100 text-sm">Select a shelf &rarr; Scan books sequentially &rarr; Instant misfile detection</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {!selectedShelf ? (
        /* ── Shelf Selection Grid ── */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                Select a Shelf to Audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingShelves ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : shelves.length === 0 ? (
                <div className="text-center py-12">
                  <Library className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No shelves configured yet</p>
                  <p className="text-sm text-gray-400 mt-1">Add books with rack/shelf numbers to begin auditing</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {shelves.map((shelf) => {
                    const [rack, shelfLetter] = shelf.label.split("-");
                    return (
                      <button
                        key={shelf.label}
                        onClick={() => selectShelf(shelf.label)}
                        className="group relative p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all text-left"
                      >
                        {/* Color indicator */}
                        {shelf.locationColor && (
                          <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-xl ${getLocationColor(shelf.locationColor)}`} />
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <Layers className="w-4 h-4 text-blue-700" />
                          </div>
                          <span className="font-mono font-bold text-gray-900">{shelf.label}</span>
                        </div>
                        <p className="text-xs text-gray-500">{shelf.count} book{shelf.count !== 1 ? "s" : ""}</p>
                        {shelf.locationColor && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${getLocationColor(shelf.locationColor)}`} />
                            <span className="text-[10px] text-gray-400">{shelf.locationColor}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* ── Active Auditing Interface ── */
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Scanner + Results */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Scanner Input */}
            <Card className="fatimi-card border-blue-200">
              <div className="fatimi-card-header" style={{ background: "linear-gradient(90deg, #1d4ed8, #d4af37, #1d4ed8)" }} />
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Scan className="w-5 h-5 text-blue-600" />
                    Auditing: <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg">{selectedShelf}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={backToShelves} className="text-gray-500">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Change Shelf
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Scan Progress */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: expectedBooks.length > 0 ? `${(scanResults.length / expectedBooks.length) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                    {scanResults.length} / {expectedBooks.length} scanned
                  </span>
                </div>

                {/* Scan Input */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                    <label htmlFor="barcode-scan" className="sr-only">Scan barcode</label>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      id="barcode-scan"
                      name="barcode-scan"
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Scan book barcode..."
                      className="w-full rounded-xl border-2 border-blue-200 pl-11 pr-4 py-3 text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleScan}
                    disabled={!scannedBarcode.trim() || scanning}
                    variant="admin"
                    size="lg"
                    className="px-6"
                  >
                    {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  </Button>
                </div>

                {/* Live Stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{stats.correct}</p>
                    <p className="text-xs text-emerald-600">Correct</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                    <p className="text-2xl font-bold text-red-700">{stats.incorrect}</p>
                    <p className="text-xs text-red-600">Misplaced</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                    <p className="text-2xl font-bold text-blue-700">{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100}%</p>
                    <p className="text-xs text-blue-600">Accuracy</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scan Results */}
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  Scan Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scanResults.length === 0 ? (
                  <div className="text-center py-8">
                    <Scan className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Start scanning books to see results</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    <AnimatePresence>
                      {scanResults.map((result, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                            result.isCorrectLocation
                              ? "bg-emerald-50 border-emerald-300"
                              : "bg-red-50 border-red-300"
                          }`}
                        >
                          {result.isCorrectLocation ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{result.book.title}</p>
                              {result.book.locationColor && (
                                <div className={`w-3 h-3 rounded-sm shrink-0 ${getLocationColor(result.book.locationColor)}`} />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Expected: <span className="font-mono font-medium text-emerald-700">{result.book.expectedLocation}</span>
                              {!result.isCorrectLocation && (
                                <>
                                  {" → "}Found at: <span className="font-mono font-medium text-red-700">{result.book.actualLocation}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <Badge variant={result.isCorrectLocation ? "success" : "destructive"} className="text-[10px]">
                            {result.isCorrectLocation ? "✓ OK" : "MISFILED"}
                          </Badge>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Expected Books List */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-5 text-blue-600" />
                  Expected Books on {selectedShelf}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBooks ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {expectedBooks.map((book, i) => {
                      const scanned = scanResults.find((r) => r.book.id === book.id);
                      return (
                        <div
                          key={book.id}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                            scanned
                              ? scanned.isCorrectLocation
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-red-50 text-red-800"
                              : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{
                              background: scanned
                                ? scanned.isCorrectLocation
                                  ? "#d1fae5"
                                  : "#fee2e2"
                                : "#f3f4f6",
                              color: scanned
                                ? scanned.isCorrectLocation
                                  ? "#047857"
                                  : "#dc2626"
                                : "#6b7280",
                            }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{book.title}</p>
                            {book.barcode && (
                              <p className="text-[10px] opacity-70 font-mono">{book.barcode}</p>
                            )}
                          </div>
                          {book.locationColor && (
                            <div className={`w-2.5 h-6 rounded-sm shrink-0 ${getLocationColor(book.locationColor)}`} />
                          )}
                          {scanned && (
                            scanned.isCorrectLocation
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}
