"use client";

import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, CheckCircle2, Copy, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface ElearningQuranSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ElearningQuranSyncModal({
  open,
  onOpenChange,
  onSuccess,
}: ElearningQuranSyncModalProps) {
  const [loading, setLoading] = useState(false);
  const [jsonData, setJsonData] = useState("");
  const [syncDate, setSyncDate] = useState(new Date().toISOString().split("T")[0]);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Bookmarklet code snippet that teachers can use on teachers.elearningquran.com
  const bookmarkletCode = `javascript:(function(){
    var rows = Array.from(document.querySelectorAll("table tr")).slice(1);
    var evals = rows.map(r => {
      var cells = r.querySelectorAll("td");
      if(cells.length < 4) return null;
      return {
        its: cells[0]?.innerText.trim(),
        name: cells[1]?.innerText.trim(),
        sabaqSurah: cells[2]?.innerText.trim(),
        sabaqMarks: parseFloat(cells[3]?.innerText.trim()) || 8,
        performanceRating: "MUMTAZ"
      };
    }).filter(Boolean);
    prompt("Copy this JSON and paste into Darse Burhani Sync:", JSON.stringify(evals));
  })();`;

  const handleSync = async () => {
    if (!jsonData.trim()) {
      toast({ variant: "destructive", title: "Missing Payload", description: "Please paste the evaluation JSON data" });
      return;
    }

    try {
      setLoading(true);
      let parsed;
      try {
        parsed = JSON.parse(jsonData);
      } catch {
        toast({ variant: "destructive", title: "Format Error", description: "Invalid JSON format. Please check the pasted data." });
        setLoading(false);
        return;
      }

      const evaluationsArray = Array.isArray(parsed) ? parsed : [parsed];

      const res = await fetch("/api/hifz/daily-evaluation/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluations: evaluationsArray,
          date: syncDate,
          source: "ELEARNING_QURAN",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync evaluations");
      }

      setSyncResult(data);
      toast({ variant: "default", title: "Sync Successful", description: `Successfully synced ${data.processedCount} student evaluations!` });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: err.message || "Failed to sync evaluations" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    toast({ variant: "default", title: "Copied", description: "eLearningQuran 1-Click Bookmarklet copied to clipboard!" });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-slate-800">
            <RefreshCw className="w-5 h-5 text-amber-600" />
            Sync from Mahad Al-Zahra (eLearningQuran)
          </ModalTitle>
          <ModalDescription>
            Import daily evaluations from <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded">teachers.elearningquran.com</code> to reflect directly to talabat.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-2">
          {/* Date Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="syncDate">Evaluation Date</Label>
            <Input
              id="syncDate"
              type="date"
              value={syncDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSyncDate(e.target.value)}
            />
          </div>

          {/* 1-Click Helper */}
          <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span>Quick Extractor (Bookmarklet)</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300 bg-white"
                onClick={handleCopyBookmarklet}
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy Bookmarklet
              </Button>
            </div>
            <p className="text-[11px] text-amber-800">
              Paste into your browser bookmark bar to copy student marks directly with 1 click while logged into eLearningQuran.
            </p>
          </div>

          {/* JSON Payload Input */}
          <div className="space-y-1.5">
            <Label htmlFor="jsonData">Paste Daily Evaluation Payload (JSON)</Label>
            <textarea
              id="jsonData"
              rows={5}
              placeholder='[{"its": "12345678", "sabaqSurah": "An-Naba", "sabaqLines": 15, "sabaqMarks": 9, "currentJuz": 30, "currentSafah": 582}]'
              value={jsonData}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonData(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Results preview */}
          {syncResult && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sync Complete: </strong>
                {syncResult.processedCount} of {syncResult.totalCount} records matched and saved. Students' daily feedback and Ikhtebaar readiness updated.
              </div>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleSync}
            disabled={loading || !jsonData.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-1.5" />
                Sync & Reflect to Talabat
              </>
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
