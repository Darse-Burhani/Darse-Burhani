"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Printer, X, Loader2, CheckCircle2, Search } from "lucide-react";
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
  coverImage: string | null;
}

interface PrintBarcodeLabelsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: LibraryBook[];
}

// ── Barcode SVG Component ──
function BarcodeSvg({ value, width = 1.8, height = 0.7 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!svgRef.current || !value) return;
      setError(false);
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        if (!cancelled && svgRef.current) {
          JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width: width,
            height: height * 96,
            displayValue: false,
            margin: 0,
            background: "#ffffff",
          });
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [value, width, height]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-12 bg-gray-50 rounded text-[8px] text-gray-500 font-mono">
        {value}
      </div>
    );
  }

  return <svg ref={svgRef} className="w-full" />;
}

// ── Single Label ──
function BookLabel({ book }: { book: LibraryBook }) {
  const barcode = book.barcode || book.id.slice(0, 8).toUpperCase();

  return (
    <div className="book-label border border-gray-300 rounded-md p-2 bg-white flex flex-col items-center gap-1 overflow-hidden" style={{ width: "2.625in", minHeight: "1in" }}>
      {/* Barcode */}
      <div className="w-full px-0.5">
        <BarcodeSvg value={barcode} width={1.2} height={0.5} />
      </div>
      {/* Barcode Text */}
      <div className="text-[7px] font-mono font-bold tracking-wider text-gray-800 text-center leading-tight">
        {barcode}
      </div>
      {/* Book Title */}
      <div className="text-[6.5px] font-medium text-gray-700 text-center leading-tight line-clamp-2 px-0.5">
        {book.title}
      </div>
      {/* Category + Location */}
      {(book.category || book.rackNumber || book.shelfNumber) && (
        <div className="text-[5.5px] text-gray-500 text-center leading-tight">
          {book.category}
          {book.rackNumber && ` · ${book.rackNumber}`}
          {book.shelfNumber && `-${book.shelfNumber}`}
        </div>
      )}
    </div>
  );
}

// ── Main Print Component ──
export default function PrintBarcodeLabels({ open, onOpenChange, books }: PrintBarcodeLabelsProps) {
  const printFrameRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  // Filter books
  const filteredBooks = books.filter((b) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      b.title.toLowerCase().includes(s) ||
      (b.author || "").toLowerCase().includes(s) ||
      (b.barcode || "").toLowerCase().includes(s) ||
      b.category.toLowerCase().includes(s)
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
      .map(
        (book) => `
        <div class="label-wrapper">
          <div class="label">
            <div class="barcode-container">
              <svg class="barcode-svg" data-barcode="${book.barcode || book.id.slice(0, 8).toUpperCase()}"></svg>
            </div>
            <div class="barcode-text">${book.barcode || book.id.slice(0, 8).toUpperCase()}</div>
            <div class="title">${escapeHtml(book.title)}</div>
            <div class="meta">${escapeHtml(book.category)}${book.rackNumber ? ` · ${escapeHtml(book.rackNumber)}` : ""}${book.shelfNumber ? `-${escapeHtml(book.shelfNumber)}` : ""}</div>
          </div>
        </div>`
      )
      .join("");

    // Open print window
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups for this site to print labels", variant: "destructive" });
      setIsPrinting(false);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcode Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            font-family: 'Courier New', monospace;
            background: white;
          }

          .labels-grid {
            display: grid;
            grid-template-columns: repeat(3, 2.625in);
            gap: 0.125in 0.125in;
            justify-content: center;
            padding: 0.1in;
          }

          .label-wrapper {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .label {
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 0.08in 0.06in;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            min-height: 1in;
            background: white;
          }

          .barcode-container {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          .barcode-svg {
            max-width: 100%;
            height: 0.45in;
          }

          .barcode-text {
            font-size: 7px;
            font-weight: bold;
            letter-spacing: 1px;
            color: #222;
            text-align: center;
          }

          .title {
            font-size: 6.5px;
            font-weight: 500;
            color: #333;
            text-align: center;
            line-height: 1.2;
            max-height: 2.2em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .meta {
            font-size: 5.5px;
            color: #888;
            text-align: center;
          }

          @media print {
            body { background: white; }
            .label { border: 0.5px solid #999; }
          }
        </style>
      </head>
      <body>
        <div class="labels-grid" id="labelsGrid">
          ${labelsHtml}
        </div>
        <script>
          // Render all barcodes after the DOM is ready
          document.querySelectorAll('.barcode-svg').forEach(function(svg) {
            try {
              JsBarcode(svg, svg.dataset.barcode, {
                format: 'CODE128',
                width: 1.2,
                height: 25,
                displayValue: false,
                margin: 0,
                background: '#ffffff',
              });
            } catch(e) {
              svg.outerHTML = '<div style="font-size:10px;text-align:center">' + svg.dataset.barcode + '<\/div>';
            }
          });

          // Auto-print after a short delay to let barcodes render
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 500);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();

    setIsPrinting(false);
    toast({ title: "Printing labels", description: `${selectedBooks.length} label(s) sent to printer`, variant: "success" });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            Print Barcode Labels
          </ModalTitle>
          <ModalDescription>Select books to print scannable barcode labels</ModalDescription>
        </ModalHeader>

        {/* Search + Controls */}
        <div className="px-6 pb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <label htmlFor="search-books" className="sr-only">Search books</label>
            <input
              type="text"
              id="search-books"
              name="search-books"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search books..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-xs text-emerald-700 hover:text-emerald-700 font-medium whitespace-nowrap"
          >
            {selectAll ? "Deselect All" : "Select All"}
          </button>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {selectedIds.size} of {books.length} selected
          </span>
        </div>

        {/* Book List with Labels Preview */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredBooks.map((book) => {
              const isSelected = selectedIds.has(book.id);
              const barcode = book.barcode || book.id.slice(0, 8).toUpperCase();
              return (
                <motion.button
                  key={book.id}
                  onClick={() => toggleBook(book.id)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-50/50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Check indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  {/* Mini label preview */}
                  <div className="border border-gray-200 rounded bg-white p-1.5 flex flex-col items-center gap-0.5 mb-2">
                    <div className="h-5 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded flex items-center justify-center">
                      <span className="text-[5px] font-mono font-bold text-gray-600 tracking-widest">
                        {barcode}
                      </span>
                    </div>
                    <div className="text-[7px] font-medium text-gray-700 text-center leading-tight line-clamp-1">
                      {book.title}
                    </div>
                  </div>

                  {/* Book info */}
                  <div className="text-xs font-medium text-gray-900 truncate">{book.title}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {book.author || "—"} · {book.category}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-700 mt-0.5 font-semibold">
                    {barcode}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Printer className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No books match your search</p>
            </div>
          )}
        </div>

        <ModalFooter className="border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={selectedIds.size === 0 || isPrinting}
            variant="admin"
            className="gap-2"
          >
            {isPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            Print {selectedIds.size} Label{selectedIds.size !== 1 ? "s" : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Helper ──
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
