"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Printer, CheckCircle2, Search, QrCode, Barcode, Sparkles, Filter, Layers } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// ── Types ──
interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  category: string;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor?: string | null;
  coverImage?: string | null;
}

interface PrintBarcodeLabelsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: LibraryBook[];
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function PrintBarcodeLabels({ open, onOpenChange, books }: PrintBarcodeLabelsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [formatMode, setFormatMode] = useState<"QR" | "BARCODE" | "DUAL">("QR");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  // Extract categories
  const categories = ["ALL", ...Array.from(new Set(books.map((b) => b.category || "General")))];

  // Filter books
  const filteredBooks = books.filter((b) => {
    const matchesCat = categoryFilter === "ALL" || (b.category || "General") === categoryFilter;
    if (!matchesCat) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      b.title.toLowerCase().includes(s) ||
      (b.author || "").toLowerCase().includes(s) ||
      (b.barcode || "").toLowerCase().includes(s) ||
      b.category.toLowerCase().includes(s) ||
      (b.rackNumber || "").toLowerCase().includes(s)
    );
  });

  // Toggle selection
  const toggleBook = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(filteredBooks.map((b) => b.id)));
      setSelectAll(true);
    }
  };

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(books.map((b) => b.id)));
      setSelectAll(true);
      setSearchTerm("");
      setCategoryFilter("ALL");
    }
  }, [open, books]);

  // ── Handle Print ──
  const handlePrint = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No books selected", description: "Select at least one book to print labels", variant: "warning" });
      return;
    }

    setIsPrinting(true);

    const selectedBooks = books.filter((b) => selectedIds.has(b.id));

    const labelsHtml = selectedBooks
      .map((book) => {
        const barcodeVal = book.barcode || book.id.slice(0, 8).toUpperCase();
        const loc = [book.rackNumber, book.shelfNumber].filter(Boolean).join(" · ") || "Library Shelf";

        if (formatMode === "QR") {
          return `
          <div class="label-wrapper">
            <div class="label label-qr">
              <div class="header-band">
                <span class="category-tag">${escapeHtml(book.category)}</span>
                <span class="location-tag">${escapeHtml(loc)}</span>
              </div>
              <div class="qr-content-row">
                <div class="qr-box">
                  <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(barcodeVal)}" alt="QR" />
                </div>
                <div class="info-box">
                  <div class="barcode-badge">${escapeHtml(barcodeVal)}</div>
                  <div class="book-title">${escapeHtml(book.title)}</div>
                  <div class="book-author">${escapeHtml(book.author || "Maktabat Darse Burhani")}</div>
                </div>
              </div>
              <div class="footer-line">Maktabat Darse Burhani</div>
            </div>
          </div>`;
        }

        if (formatMode === "DUAL") {
          return `
          <div class="label-wrapper">
            <div class="label label-dual">
              <div class="header-band">
                <span class="category-tag">${escapeHtml(book.category)}</span>
                <span class="location-tag">${escapeHtml(loc)}</span>
              </div>
              <div class="dual-row">
                <div class="qr-box">
                  <img class="qr-img-small" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(barcodeVal)}" alt="QR" />
                </div>
                <div class="barcode-side">
                  <svg class="barcode-svg" data-barcode="${barcodeVal}"></svg>
                  <div class="barcode-text">${barcodeVal}</div>
                </div>
              </div>
              <div class="book-title-dual">${escapeHtml(book.title)}</div>
              <div class="book-author">${escapeHtml(book.author || "Maktabat Darse Burhani")}</div>
            </div>
          </div>`;
        }

        // Standard Barcode Mode
        return `
        <div class="label-wrapper">
          <div class="label">
            <div class="barcode-container">
              <svg class="barcode-svg" data-barcode="${barcodeVal}"></svg>
            </div>
            <div class="barcode-text">${barcodeVal}</div>
            <div class="book-title">${escapeHtml(book.title)}</div>
            <div class="meta">${escapeHtml(book.category)} · ${escapeHtml(loc)}</div>
          </div>
        </div>`;
      })
      .join("");

    // Open print window
    const printWindow = window.open("", "_blank", "width=850,height=700");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups for this site to print labels", variant: "destructive" });
      setIsPrinting(false);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Maktabat QR & Barcode Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: letter;
            margin: 0.4in;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            background: white;
            color: #111;
          }

          .labels-grid {
            display: grid;
            grid-template-columns: repeat(3, 2.55in);
            gap: 0.15in 0.15in;
            justify-content: center;
            padding: 0.1in;
          }

          .label-wrapper {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .label {
            border: 1.5px solid #064e3b;
            border-radius: 6px;
            padding: 0.08in 0.08in;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: white;
            min-height: 1.35in;
            position: relative;
          }

          .label-qr {
            align-items: stretch;
            justify-content: space-between;
          }

          .header-band {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #d1fae5;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }

          .category-tag {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            color: #065f46;
            letter-spacing: 0.5px;
          }

          .location-tag {
            font-size: 7.5px;
            font-weight: 700;
            color: #92400e;
            background: #fef3c7;
            padding: 1px 4px;
            border-radius: 3px;
          }

          .qr-content-row {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .qr-box {
            width: 0.75in;
            height: 0.75in;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 2px;
          }

          .qr-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .qr-img-small {
            width: 0.65in;
            height: 0.65in;
            object-fit: contain;
          }

          .info-box {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .barcode-badge {
            font-family: monospace;
            font-size: 8px;
            font-weight: 800;
            color: #022c22;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 1px 4px;
            border-radius: 3px;
            display: inline-block;
            width: fit-content;
          }

          .book-title {
            font-size: 8.5px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.2;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .book-title-dual {
            font-size: 8px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.15;
            text-align: center;
            margin-top: 2px;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .book-author {
            font-size: 7px;
            color: #64748b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .footer-line {
            font-size: 6.5px;
            font-weight: 700;
            color: #059669;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 2px;
            margin-top: 3px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          .dual-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            width: 100%;
          }

          .barcode-side {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .barcode-svg {
            max-width: 100%;
            height: 0.35in;
          }

          .barcode-text {
            font-family: monospace;
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #111;
            text-align: center;
          }

          .meta {
            font-size: 7px;
            color: #64748b;
            text-align: center;
            margin-top: 2px;
          }

          @media print {
            body { background: white; }
            .label { border: 1px solid #064e3b; }
          }
        </style>
      </head>
      <body>
        <div class="labels-grid" id="labelsGrid">
          ${labelsHtml}
        </div>
        <script>
          // Render barcodes if present
          document.querySelectorAll('.barcode-svg').forEach(function(svg) {
            try {
              JsBarcode(svg, svg.dataset.barcode, {
                format: 'CODE128',
                width: 1.1,
                height: 22,
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
    toast({ title: "QR & Barcode Labels Ready", description: `${selectedBooks.length} book label(s) generated for printing`, variant: "success" });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                <QrCode className="w-4 h-4" />
              </div>
              <span>Maktabat QR &amp; Barcode Label Studio</span>
            </ModalTitle>
          </div>
          <ModalDescription>
            Generate and print high-density QR codes and Code-128 barcode stickers for library books and physical shelves.
          </ModalDescription>
        </ModalHeader>

        {/* Format Selector Toolbar */}
        <div className="px-6 py-2 bg-slate-50 border-y border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Label Format:</span>
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setFormatMode("QR")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formatMode === "QR" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>2D QR Code</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatMode("DUAL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formatMode === "DUAL" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Dual (QR + Barcode)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatMode("BARCODE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formatMode === "BARCODE" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>1D Barcode</span>
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 px-2.5 py-1 bg-white text-slate-700 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "ALL" ? "All Genres" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search + Selection Controls */}
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search books by title, author, barcode, or rack..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50/70"
            />
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-xs text-emerald-800 hover:text-emerald-950 font-bold whitespace-nowrap cursor-pointer"
          >
            {selectAll ? "Deselect All" : "Select All"}
          </button>
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100">
            {selectedIds.size} of {books.length} Selected
          </span>
        </div>

        {/* Book List with Live Labels Preview */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredBooks.map((book) => {
              const isSelected = selectedIds.has(book.id);
              const barcode = book.barcode || book.id.slice(0, 8).toUpperCase();
              return (
                <motion.button
                  key={book.id}
                  onClick={() => toggleBook(book.id)}
                  className={`relative rounded-2xl border-2 p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Selection Check Indicator */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  {/* Visual QR & Barcode Card Preview */}
                  <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex items-center gap-2.5 mb-2 shadow-2xs">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      {formatMode === "QR" || formatMode === "DUAL" ? (
                        <QrCode className="w-6 h-6 text-emerald-800" />
                      ) : (
                        <Barcode className="w-6 h-6 text-emerald-800" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-bold text-slate-800 block truncate">
                        {barcode}
                      </span>
                      <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">
                        {book.rackNumber || "Rack-A1"}
                      </span>
                    </div>
                  </div>

                  {/* Book Metadata */}
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">{book.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{book.author || "Maktabat Darse Burhani"}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {book.category}
                      </span>
                      {book.shelfNumber && (
                        <span className="text-[9px] font-medium text-slate-500">
                          {book.shelfNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <ModalFooter className="border-t border-slate-100 px-6 py-3 bg-slate-50">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isPrinting || selectedIds.size === 0}
            className="btn-fatimi-gold text-white font-bold rounded-xl shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            <span>Print {selectedIds.size} {formatMode} Label(s)</span>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
