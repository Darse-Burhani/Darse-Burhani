// Generates twilight-palace overrides for hardcoded green arbitrary-value
// utility classes (bg-[#06241a], text-[#047857] …) found in client TSX.
// Run: node scripts/gen-twilight-overrides.mjs  (appends nothing; prints CSS)
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("client/src");

// Green-family hex → twilight equivalent (sunset amber family / navy darks)
const MAP = new Map(
  Object.entries({
    // Emerald / brand emerald scale
    "#ecfdf5": "#fffbeb", "#d1fae5": "#fef3c7", "#a7f3d0": "#fde68a",
    "#6ee7b7": "#fcd34d", "#34d399": "#fbbf24", "#10b981": "#f59e0b",
    "#059669": "#d97706", "#047857": "#b45309", "#065f46": "#92400e",
    "#064e3b": "#78350f", "#022c22": "#451a03", "#00f090": "#ffb020",
    // Teal scale
    "#f0fdfa": "#fdf8ef", "#ccfbf1": "#faedd4", "#99f6e4": "#f3d8a8",
    "#5eead4": "#e9bc73", "#2dd4bf": "#dd9a3e", "#14b8a6": "#c97f1f",
    "#0d9488": "#a86416", "#0f766e": "#864d14", "#115e59": "#6b3d14",
    "#134e4a": "#573313", "#042f2e": "#301a0a",
    // Green scale
    "#f0fdf4": "#fffbeb", "#dcfce7": "#fef3c7", "#bbf7d0": "#fde68a",
    "#86efac": "#fcd34d", "#4ade80": "#fbbf24", "#22c55e": "#f59e0b",
    "#16a34a": "#d97706", "#15803d": "#b45309", "#166534": "#92400e",
    "#14532d": "#78350f", "#052e16": "#451a03",
    // Brand dark greens (buttons / sidebars / heroes) → twilight navies
    "#06241a": "#1a2038", "#0a3d2c": "#2a3358", "#044e3a": "#1a2038",
    "#044e39": "#1a2038", "#05372b": "#2a3358", "#056046": "#2a3358",
    "#034430": "#22294a", "#034433": "#22294a", "#093b2a": "#22294a",
    "#094d37": "#2a3358", "#093527": "#1a2038", "#0c1f17": "#10142a",
    "#0c2219": "#10142a", "#0b1d17": "#10142a", "#021e17": "#0c1026",
    "#021f18": "#0c1026", "#03180f": "#0c1026", "#031d14": "#0c1026",
    "#03170e": "#0c1026", "#032018": "#0c1026", "#041a13": "#0c1026",
    "#041a12": "#0c1026", "#041d14": "#0c1026", "#042f24": "#10142a",
    "#05281b": "#0c1026", "#01140f": "#0c1026", "#011f18": "#0c1026",
    "#01241c": "#10142a", "#062016": "#0c1026",
  })
);

const PROPS = {
  bg: (h) => `background-color: ${h};`,
  text: (h) => `color: ${h};`,
  border: (h) => `border-color: ${h};`,
  ring: (h) => `--tw-ring-color: ${h};`,
  outline: (h) => `outline-color: ${h};`,
  fill: (h) => `fill: ${h};`,
  stroke: (h) => `stroke: ${h};`,
  from: (h) =>
    `--tw-gradient-from: ${h}; --tw-gradient-to: rgb(255 255 255 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`,
  to: (h) => `--tw-gradient-to: ${h};`,
  via: (h) => `--tw-gradient-stops: var(--tw-gradient-from), ${h}, var(--tw-gradient-to);`,
  divide: (h) => `border-color: ${h};`,
};

const VARIANT_PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  active: ":active",
  disabled: ":disabled",
};

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) yield p;
  }
}

const re = /\b((?:hover|focus|focus-visible|active|disabled):)?(bg|text|border|ring|from|via|to|divide|outline|fill|stroke)-\[(#[0-9a-fA-F]{6})\]/g;
const rules = new Set();

for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(re)) {
    const [, variantRaw = "", util, hex] = m;
    const twilight = MAP.get(hex.toLowerCase());
    if (!twilight) continue;
    // variantRaw includes the trailing colon ("hover:") — strip it
    const variant = variantRaw ? variantRaw.replace(/:$/, "") : "";
    const pseudo = variant ? VARIANT_PSEUDO[variant] : "";
    if (variant && !pseudo) continue;
    const base = `${variant ? variant + ":" : ""}${util}-[${hex}]`;
    const esc = base.replace(/[:[\]#]/g, (c) => "\\" + c);
    let selector = `[data-fatimi-theme="twilight-palace"] .${esc}${pseudo}`;
    if (util === "divide") selector += " > :not([hidden]) ~ :not([hidden])";
    rules.add(`${selector} {\n  ${PROPS[util](twilight)}\n}`);
  }
}

const out = [...rules].sort().join("\n");
const header = `/* ── Twilight Palace: hardcoded green arbitrary utilities (auto-generated
      by scripts/gen-twilight-overrides.mjs) — targets bg/text/border/ring/
      gradient/outline/fill/stroke + variant forms of the green hexes that
      bypass the CSS-variable palette. ── */\n`;
fs.writeFileSync(path.resolve("client/src/twilight-overrides.css"), header + out + "\n");
console.log(`wrote ${rules.size} override rules -> client/src/twilight-overrides.css`);
