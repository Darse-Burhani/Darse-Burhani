"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Printer,
  CheckCircle2,
  Search,
  Barcode,
  Filter,
  FileSpreadsheet,
  Download,
  Layers,
  MapPin,
  CheckSquare,
  Square,
} from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// ── Types ──
export interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  category: string;
  barcode: string | null;
  rackNumber?: string | null;
  shelfNumber?: string | null;
  locationColor?: string | null;
  coverImage?: string | null;
  status?: string;
  totalCopies?: number;
  availableCopies?: number;
}

interface PrintBarcodeLabelsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: LibraryBook[];
  initialRack?: string;
  initialShelf?: string;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function PrintBarcodeLabels({
  open,
  onOpenChange,
  books,
  initialRack,
  initialShelf,
}: PrintBarcodeLabelsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [rackFilter, setRackFilter] = useState("ALL");
  const [shelfFilter, setShelfFilter] = useState("ALL");
  const [labelSizeFormat, setLabelSizeFormat] = useState<"standard_sheet" | "thermal_50x30">("standard_sheet");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);

  // Extract unique categories, racks, and shelves
  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(books.map((b) => b.category || "General"))).sort()],
    [books]
  );

  const racks = useMemo(
    () => ["ALL", ...Array.from(new Set(books.map((b) => b.rackNumber).filter(Boolean) as string[])).sort()],
    [books]
  );

  const shelves = useMemo(() => {
    const pool = rackFilter === "ALL" ? books : books.filter((b) => b.rackNumber === rackFilter);
    return ["ALL", ...Array.from(new Set(pool.map((b) => b.shelfNumber).filter(Boolean) as string[])).sort()];
  }, [books, rackFilter]);

  // Sync initialRack and initialShelf when modal opens
  useEffect(() => {
    if (open) {
      const initR = initialRack || "ALL";
      const initS = initialShelf || "ALL";
      setRackFilter(initR);
      setShelfFilter(initS);
      setCategoryFilter("ALL");
      setSearchTerm("");

      const matching = books.filter((b) => {
        if (initR !== "ALL" && b.rackNumber !== initR) return false;
        if (initS !== "ALL" && b.shelfNumber !== initS) return false;
        return true;
      });

      setSelectedIds(new Set(matching.map((b) => b.id)));
    }
  }, [open, books, initialRack, initialShelf]);

  // When rack changes, adjust shelf filter if needed
  const handleRackChange = (newRack: string) => {
    setRackFilter(newRack);
    setShelfFilter("ALL");
  };

  // Filter books based on active criteria
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchesCat = categoryFilter === "ALL" || (b.category || "General") === categoryFilter;
      if (!matchesCat) return false;

      const matchesRack = rackFilter === "ALL" || b.rackNumber === rackFilter;
      if (!matchesRack) return false;

      const matchesShelf = shelfFilter === "ALL" || b.shelfNumber === shelfFilter;
      if (!matchesShelf) return false;

      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        b.title.toLowerCase().includes(s) ||
        (b.author || "").toLowerCase().includes(s) ||
        (b.barcode || "").toLowerCase().includes(s) ||
        (b.category || "").toLowerCase().includes(s) ||
        (b.rackNumber || "").toLowerCase().includes(s) ||
        (b.shelfNumber || "").toLowerCase().includes(s)
      );
    });
  }, [books, categoryFilter, rackFilter, shelfFilter, searchTerm]);

  // Selection helpers
  const toggleBook = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBooks.forEach((b) => next.add(b.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBooks.forEach((b) => next.delete(b.id));
      return next;
    });
  };

  const isAllFilteredSelected = filteredBooks.length > 0 && filteredBooks.every((b) => selectedIds.has(b.id));

  // ── Export Selected Books to Excel / CSV ──
  const handleExportExcel = () => {
    const targetBooks = books.filter((b) => selectedIds.has(b.id));
    if (targetBooks.length === 0) {
      toast({ title: "No books selected", description: "Select at least one book to export", variant: "warning" });
      return;
    }

    const headers = [
      "Barcode",
      "Book Title",
      "Author",
      "Category",
      "Rack Number",
      "Shelf Number",
      "Status",
      "Available Copies",
      "Total Copies",
    ];
    const rows = targetBooks.map((b) => [
      `"${(b.barcode || b.id.slice(0, 8).toUpperCase()).replace(/"/g, '""')}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${(b.author || "N/A").replace(/"/g, '""')}"`,
      `"${(b.category || "General").replace(/"/g, '""')}"`,
      `"${(b.rackNumber || "").replace(/"/g, '""')}"`,
      `"${(b.shelfNumber || "").replace(/"/g, '""')}"`,
      `"${(b.status || "AVAILABLE").replace(/"/g, '""')}"`,
      b.availableCopies ?? 1,
      b.totalCopies ?? 1,
    ]);

    // Prepend UTF-8 BOM so Excel opens Arabic and special characters properly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Maktabat_Barcodes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Excel Export Generated 📊",
      description: `Exported ${targetBooks.length} book records with barcodes and shelf locations`,
      variant: "success",
    });
  };

  // ── Handle Print Standard Barcode Labels ──
  // Note: Two items below book name (author & footer) are intentionally removed as requested.
  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No books selected", description: "Select at least one book to print labels", variant: "warning" });
      return;
    }

    setIsPrinting(true);

    const selectedBooks = books.filter((b) => selectedIds.has(b.id));

    // Pure Clean Standard Barcode Sticker:
    // 1. Header band (Category + Maktabat DB)
    // 2. Crisp Code-128 Barcode graphic
    // 3. Barcode text code (e.g. DB-MSH-003)
    // 4. Book title (prominent & bold)
    // -> NO author below book name
    // -> NO footer line below book name
    const labelsHtml = selectedBooks
      .map((book) => {
        const barcodeVal = book.barcode || book.id.slice(0, 8).toUpperCase();

        return `
        <div class="label-wrapper">
          <div class="label">
            <div class="header-band">
              <span class="category-tag">${escapeHtml(book.category || "GENERAL")}</span>
              <span class="inst-tag">Maktabat DB</span>
            </div>
            <div class="barcode-container">
              <svg class="barcode-svg" data-barcode="${barcodeVal}"></svg>
            </div>
            <div class="barcode-meta-row">
              <span class="barcode-text">${barcodeVal}</span>
            </div>
            <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
          </div>
        </div>`;
      })
      .join("");

    // Open print window
    const printWindow = window.open("", "_blank", "width=850,height=750");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups for this site to print labels", variant: "destructive" });
      setIsPrinting(false);
      return;
    }

    const isThermal = labelSizeFormat === "thermal_50x30";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Maktabat Barcode Labels (${selectedBooks.length} Labels)</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            ${
              isThermal
                ? "size: 50mm 30mm; margin: 0;"
                : "size: A4 portrait; margin: 0.35in 0.28in;"
            }
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Arabic", Arial, sans-serif;
            background: white;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          ${
            isThermal
              ? `
              /* Standard 50mm x 30mm Thermal Barcode Roll */
              .labels-grid {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0;
              }

              .label-wrapper {
                page-break-after: always;
                break-after: page;
                width: 50mm;
                height: 30mm;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .label {
                width: 48mm;
                height: 28mm;
                border: 1px dashed #065f46;
                border-radius: 4px;
                padding: 1.5mm 2mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                background: white;
                box-sizing: border-box;
                overflow: hidden;
              }
              `
              : `
              /* Standard A4 3-Column Barcode Sheet (24 labels: 3 cols x 8 rows, 2.5in x 1.2in / 63.5mm x 30.5mm) */
              .labels-grid {
                display: grid;
                grid-template-columns: repeat(3, 2.5in);
                gap: 0.12in 0.15in;
                justify-content: center;
                padding: 0.05in 0;
              }

              .label-wrapper {
                break-inside: avoid;
                page-break-inside: avoid;
              }

              .label {
                width: 2.5in;
                height: 1.2in;
                max-height: 1.2in;
                border: 1px dashed #065f46;
                border-radius: 5px;
                padding: 0.06in 0.08in;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                background: white;
                box-sizing: border-box;
                overflow: hidden;
              }
              `
          }

          .header-band {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 1.5px;
            margin-bottom: 1px;
          }

          .category-tag {
            font-size: 7.5px;
            font-weight: 800;
            text-transform: uppercase;
            color: #065f46;
            letter-spacing: 0.4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 65%;
          }

          .inst-tag {
            font-size: 6.5px;
            font-weight: 700;
            color: #92400e;
            background: #fef3c7;
            padding: 1px 3px;
            border-radius: 2px;
            white-space: nowrap;
          }

          .barcode-container {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 1px 0;
            height: 28px;
            overflow: hidden;
          }

          .barcode-svg {
            max-width: 100%;
            height: 26px;
          }

          .barcode-meta-row {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            line-height: 1;
          }

          .barcode-text {
            font-weight: 800;
            font-size: 9px;
            letter-spacing: 0.8px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #0f172a;
          }

          .book-title {
            width: 100%;
            text-align: center;
            font-weight: 700;
            font-size: 9.5px;
            line-height: 1.2;
            max-height: 23px;
            overflow: hidden;
            color: #0f172a;
            direction: auto;
          }

          @media print {
            body { background: white; }
            .label { border: 1px solid #94a3b8; }
          }
        </style>
      </head>
      <body>
        <div class="labels-grid" id="labelsGrid">
          ${labelsHtml}
        </div>
        <script>
          // Render crisp Code-128 barcodes
          document.querySelectorAll('.barcode-svg').forEach(function(svg) {
            try {
              JsBarcode(svg, svg.dataset.barcode, {
                format: 'CODE128',
                width: 1.25,
                height: 26,
                displayValue: false,
                margin: 0,
                background: '#ffffff',
              });
            } catch(e) {
              svg.outerHTML = '<div style="font-size:8px;font-family:monospace;text-align:center">' + svg.dataset.barcode + '<\/div>';
            }
          });

          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          }, 600);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();

    setIsPrinting(false);
    toast({
      title: "Barcode Labels Ready 🖨️",
      description: `${selectedBooks.length} standard barcode label(s) generated for printing`,
      variant: "success",
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-2xl">
        <ModalHeader className="px-6 pt-5 pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <ModalTitle className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shadow-xs">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold text-slate-900">Standard Barcode Labels &amp; Export</span>
                <p className="text-xs font-normal text-slate-500 mt-0.5">
                  Standard 2.5&quot; &times; 1.2&quot; stickers (Avery 3&times;8 sheet or 50&times;30mm thermal roll)
                </p>
              </div>
            </ModalTitle>

            {/* Sticker Size Format Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLabelSizeFormat("standard_sheet")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  labelSizeFormat === "standard_sheet"
                    ? "bg-white text-emerald-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Standard A4 sheet (3 columns x 8 rows, 2.5in x 1.2in)"
              >
                A4 Sheet (2.5&quot; &times; 1.2&quot;)
              </button>
              <button
                type="button"
                onClick={() => setLabelSizeFormat("thermal_50x30")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  labelSizeFormat === "thermal_50x30"
                    ? "bg-white text-emerald-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Continuous thermal barcode printer (50mm x 30mm)"
              >
                Thermal (50&times;30mm)
              </button>
            </div>
          </div>
        </ModalHeader>

        {/* Filter Bar with Rack & Shelf Selectors */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-800 font-medium outline-none cursor-pointer max-w-[120px]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "ALL" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Rack Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold text-slate-500">Rack:</span>
              <select
                value={rackFilter}
                onChange={(e) => handleRackChange(e.target.value)}
                className="text-xs bg-transparent text-slate-800 font-medium outline-none cursor-pointer max-w-[180px]"
              >
                {racks.map((r) => (
                  <option key={r} value={r}>
                    {r === "ALL" ? "All Racks" : r}
                  </option>
                ))}
              </select>
            </div>

            {/* Shelf Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold text-slate-500">Shelf:</span>
              <select
                value={shelfFilter}
                onChange={(e) => setShelfFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-800 font-medium outline-none cursor-pointer max-w-[110px]"
              >
                {shelves.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL" ? "All Shelves" : s}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filter Button if active */}
            {(categoryFilter !== "ALL" || rackFilter !== "ALL" || shelfFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("ALL");
                  setRackFilter("ALL");
                  setShelfFilter("ALL");
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium px-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Quick preset for Rack M Shelf 3 if available */}
          {racks.some((r) => r.includes("Rack M")) && (
            <button
              type="button"
              onClick={() => {
                const rackM = racks.find((r) => r.includes("Rack M")) || "Rack M (Fatimi Heritage & Dawat)";
                setRackFilter(rackM);
                setShelfFilter("Shelf 3");
              }}
              className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              📍 Quick: Rack M &middot; Shelf 3
            </button>
          )}
        </div>

        {/* Search + Selection Controls */}
        <div className="px-6 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, barcode, rack, shelf, or category..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/70"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAllFilteredSelected ? deselectAllFiltered : selectAllFiltered}
              className="flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold px-2 py-1 rounded-lg bg-emerald-50/70 hover:bg-emerald-100 cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                  Deselect Filtered ({filteredBooks.length})
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  Select Filtered ({filteredBooks.length})
                </>
              )}
            </button>

            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100">
              {selectedIds.size} of {books.length} Selected
            </span>
          </div>
        </div>

        {/* Book List Preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/40 min-h-[300px]">
          {filteredBooks.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No books found matching the selected rack, shelf, or search filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredBooks.map((book) => {
                const isSelected = selectedIds.has(book.id);
                const barcode = book.barcode || book.id.slice(0, 8).toUpperCase();
                const loc = [book.rackNumber, book.shelfNumber].filter(Boolean).join(" · ");

                return (
                  <motion.button
                    key={book.id}
                    onClick={() => toggleBook(book.id)}
                    className={`relative rounded-2xl border-2 p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500/20"
                        : "border-slate-200 bg-white/70 hover:border-slate-300 hover:shadow-xs"
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Selection Check Indicator */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}

                    <div className="space-y-1.5 pr-6">
                      <p className="font-bold text-xs text-slate-900 line-clamp-1">{book.title}</p>

                      <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                            {barcode}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {book.category}
                        </span>
                      </div>

                      {loc && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md truncate max-w-full">
                            <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{loc}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <ModalFooter className="border-t border-slate-200/80 px-6 py-3 bg-white flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={selectedIds.size === 0}
              className="border-emerald-300 text-emerald-900 font-bold rounded-xl text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-700" />
              Export Excel ({selectedIds.size})
            </Button>

            <Button
              onClick={handlePrint}
              disabled={isPrinting || selectedIds.size === 0}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl shadow-md active:scale-95 text-xs"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              <span>Print {selectedIds.size} Standard Sticker(s)</span>
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
