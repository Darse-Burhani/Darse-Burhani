"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { TilawatDuaViewer, type TilawatDuaItem } from "@/components/tilawat-dua/TilawatDuaViewer";
import { Button } from "@/components/ui/button";

export default function DirectProjectorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get("id");

  const [dua, setDua] = useState<TilawatDuaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjectorDua() {
      try {
        setLoading(true);
        const url = id ? `/api/tilawat-dua/${id}` : "/api/tilawat-dua/today";
        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          setDua(json.data);
        } else {
          setError("No active Tilawat Dua available for projection.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projector view");
      } finally {
        setLoading(false);
      }
    }

    fetchProjectorDua();
  }, [id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-[99999]">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Preparing Classroom Projector Display…</h2>
        <p className="text-xs text-slate-400 mt-1">Calibrating High-DPI canvas & Fatimi manuscript view</p>
      </div>
    );
  }

  if (error || !dua) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-[99999] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">{error || "Tilawat Dua Not Found"}</h2>
        <p className="text-sm text-slate-400 max-w-md mt-2 mb-6">
          The requested Tilawat Dua document could not be loaded for projector presentation.
        </p>
        <Button onClick={() => navigate(-1)} className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <TilawatDuaViewer
      dua={dua}
      initialProjectorMode={true}
      onCloseProjector={() => navigate(-1)}
    />
  );
}
