"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FatimiGirihRosette12,
  FatimiGirihJaliPattern,
  FatimiBronzeCard,
  FatimiGirihDivider,
} from "@/components/FatimiOrnaments";
import { ArrowLeft, Sparkles, Copy, Check, ShieldCheck, Flame, Compass, Star } from "lucide-react";

export default function FatimiDesignShowcase() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#faf7f0] text-[#221c12] py-8 px-4 sm:px-6 lg:px-8 selection:bg-amber-300 selection:text-black">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e7e0d0]">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#6b5f4b] hover:text-[#221c12] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="fatimi-girih-badge">Fatimi Architectural Heritage</span>
            <span className="text-xs font-mono text-[#97896f]">v2.0 • Bronze Girih</span>
          </div>
        </div>

        {/* ── 1. Reference Comparison Banner ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Reference Photo */}
          <div className="p-4 rounded-2xl bg-white border border-[#e7e0d0] shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#97896f]">
                Uploaded Metalwork Reference
              </span>
              <span className="text-[11px] text-[#b45309] font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                12-Point Girih Jali
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden flex-1 min-h-[220px] max-h-[300px] border border-amber-900/30 shadow-inner group">
              <img
                src="/fatimi-bronze-lattice.jpg"
                alt="Authentic Fatimi Bronze Girih Screen"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                <p className="text-xs text-white/90 font-medium">
                  Antique burnished bronze &amp; brass door screen with hammered recessed ground &amp; relief strapwork
                </p>
              </div>
            </div>
          </div>

          {/* CSS Translation Overview */}
          <div className="p-6 rounded-2xl fatimi-girih-bronze flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FatimiGirihRosette12 size={24} />
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffd885]">
                  CSS System Translation
                </span>
              </div>
              <h2 className="text-2xl font-bold fatimi-girih-metallic-text mb-2">
                Authentic Fatimi Bronze Jali
              </h2>
              <p className="text-sm text-stone-300 leading-relaxed">
                Directly translated into responsive CSS classes and SVG vector components. Seamlessly harmonious with the{" "}
                <strong className="text-[#ffd885]">70-30-10 Light Gold &amp; Warm Cream</strong> palette, offering both
                dark architectural panels and subtle light cream watermarks.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-[#f3b833]/30 text-[11px] font-mono text-[#fcd468]">
                .fatimi-girih-bronze
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-[#f3b833]/30 text-[11px] font-mono text-[#fcd468]">
                .fatimi-girih-watermark
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-[#f3b833]/30 text-[11px] font-mono text-[#fcd468]">
                .fatimi-girih-bezel
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-[#f3b833]/30 text-[11px] font-mono text-[#fcd468]">
                .fatimi-girih-metallic-text
              </span>
            </div>
          </div>
        </div>

        <FatimiGirihDivider label="Live Demonstrations" />

        {/* ── 2. Executive Hero Banner Demo (.fatimi-header-banner) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b5f4b]">
              A. Executive Hero Banner (.fatimi-header-banner)
            </h3>
            <button
              onClick={() =>
                copyToClipboard(
                  '<div className="fatimi-header-banner">...</div>',
                  "banner"
                )
              }
              className="inline-flex items-center gap-1.5 text-xs text-[#8c5828] hover:text-[#221c12] font-semibold"
            >
              {copiedKey === "banner" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === "banner" ? "Copied" : "Copy Class"}</span>
            </button>
          </div>

          <div className="fatimi-header-banner">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#ffd885] via-[#f3b833] to-[#8c5828] text-[#120a03] shadow-lg border border-[#ffd885]/40 shrink-0">
                  <ShieldCheck className="w-7 h-7" strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="fatimi-girih-badge">Fatimi Maktab</span>
                    <span className="text-xs text-amber-200/80 font-medium">Mahad al-Zahra • Galiakot</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Darse Burhani Portal
                  </h1>
                  <p className="text-xs sm:text-sm text-amber-100/80 font-medium mt-0.5">
                    Authentic bronze Girih lattice embedded into the luxury dark header background
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="fatimi-girih-button px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explore Curriculum</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Cards Showcase: Bronze Bezel vs Light Cream Watermark ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b5f4b]">
            B. Card Surface Variants (Dark Architectural vs Light Cream)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Photorealistic Bronze Card */}
            <FatimiBronzeCard variant="bronze" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-[#f3b833]/40 flex items-center justify-center text-[#fcd468]">
                  <Flame className="w-5 h-5" />
                </div>
                <span className="fatimi-girih-badge">Variant: Bronze</span>
              </div>
              <h4 className="text-lg font-bold fatimi-girih-metallic-text mb-2">
                Antique Bronze Card
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                Full photorealistic hammered metalwork with beveled gold framing, specular highlights, and recessed shadow depth.
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#ffd885]">
                <span>Class: .fatimi-girih-bronze</span>
                <span className="font-bold">Active</span>
              </div>
            </FatimiBronzeCard>

            {/* Card 2: 3D Beveled Cast Frame */}
            <FatimiBronzeCard variant="bezel" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-[#f3b833]/40 flex items-center justify-center text-[#fcd468]">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="fatimi-girih-badge">Variant: 3D Bezel</span>
              </div>
              <h4 className="text-lg font-bold fatimi-girih-metallic-text mb-2">
                Cast Metal Bezel Frame
              </h4>
              <p className="text-xs text-stone-300 leading-relaxed mb-4">
                Embossed bronze edge with an inner gold highlight groove, replicating the heavy cast metal architectural door frame.
              </p>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#ffd885]">
                <span>Class: .fatimi-girih-bezel</span>
                <span className="font-bold">Cast Edge</span>
              </div>
            </FatimiBronzeCard>

            {/* Card 3: 70% Warm Cream Watermark Card */}
            <div className="p-6 rounded-2xl bg-white border border-[#e7e0d0] shadow-sm fatimi-girih-watermark flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] flex items-center justify-center text-[#8c5828]">
                    <Star className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8c5828] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    70% Light Cream
                  </span>
                </div>
                <h4 className="text-lg font-bold text-[#221c12] mb-2">
                  Cream Surface Watermark
                </h4>
                <p className="text-xs text-[#6b5f4b] leading-relaxed mb-4">
                  Preserves 100% legibility on light backgrounds while embossing the subtle 4% authentic Fatimi lattice texture underneath.
                </p>
              </div>
              <div className="relative z-10 pt-3 border-t border-[#e7e0d0] flex items-center justify-between text-[11px] text-[#8c5828]">
                <span>Class: .fatimi-girih-watermark</span>
                <span className="font-bold">Cream Mode</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Pure Vector SVG Reconstruction (FatimiGirihJaliPattern) ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#6b5f4b]">
            C. Scalable Vector SVG Pattern &amp; Rosettes (Zero Pixelation)
          </h3>

          <div className="p-6 rounded-2xl bg-[#1a1107] border border-[#f3b833]/30 text-white relative overflow-hidden shadow-xl">
            {/* Vector Jali Pattern Background */}
            <FatimiGirihJaliPattern opacity={0.16} stroke="#fcd468" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <FatimiGirihRosette12 size={88} className="shrink-0 drop-shadow-[0_4px_12px_rgba(243,184,51,0.3)]" />
                <div>
                  <h4 className="text-xl font-bold fatimi-girih-metallic-text mb-1">
                    Procedural 12-Point Fatimi Rosette
                  </h4>
                  <p className="text-xs text-stone-300 max-w-lg leading-relaxed">
                    Rendered via pure SVG mathematics with multi-stop metallic linear gradients, 12 radiating strapwork arms,
                    and concentric floral core. Infinitely sharp on Retina, 4K, and mobile screens.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() =>
                    copyToClipboard(
                      '<FatimiGirihRosette12 size={120} />',
                      "rosette"
                    )
                  }
                  className="fatimi-girih-button px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedKey === "rosette" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "rosette" ? "Copied" : "Copy <FatimiGirihRosette12 />"}</span>
                </button>
                <button
                  onClick={() =>
                    copyToClipboard(
                      '<FatimiGirihJaliPattern opacity={0.08} />',
                      "pattern"
                    )
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#ffd885] bg-black/40 border border-[#f3b833]/30 hover:bg-black/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedKey === "pattern" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === "pattern" ? "Copied" : "Copy <FatimiGirihJaliPattern />"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Quick CSS Cheat Sheet ── */}
        <section className="p-6 rounded-2xl bg-white border border-[#e7e0d0] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-[#221c12]">How to Apply in Any Component</h4>
              <p className="text-xs text-[#6b5f4b]">
                Add any of these CSS classes or import the React ornaments into any page or card.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] space-y-1">
              <span className="text-[11px] font-bold text-[#8c5828] uppercase">Dark Metal Panel</span>
              <p className="text-[#221c12] select-all">
                className="fatimi-girih-bronze p-6 rounded-2xl"
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] space-y-1">
              <span className="text-[11px] font-bold text-[#8c5828] uppercase">Light Cream Watermark</span>
              <p className="text-[#221c12] select-all">
                className="fatimi-girih-watermark bg-white p-6 rounded-2xl border"
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] space-y-1">
              <span className="text-[11px] font-bold text-[#8c5828] uppercase">Metallic Gradient Text</span>
              <p className="text-[#221c12] select-all">
                className="fatimi-girih-metallic-text text-xl font-bold"
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#faf7f0] border border-[#e7e0d0] space-y-1">
              <span className="text-[11px] font-bold text-[#8c5828] uppercase">Burnished Button</span>
              <p className="text-[#221c12] select-all">
                className="fatimi-girih-button px-4 py-2 rounded-xl text-xs"
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

