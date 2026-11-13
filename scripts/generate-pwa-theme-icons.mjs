import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientPublicDir = path.join(rootDir, 'client', 'public');
const clientDistDir = path.join(rootDir, 'client', 'dist');

const logoPath = path.join(clientPublicDir, 'logo.png');
const logoBuf = fs.readFileSync(logoPath);
const b64Logo = logoBuf.toString('base64');

// 1. Generate the Master SVG Icon (512x512)
// Midnight Obsidian & Royal Fatimi Gold Sacred Geometry (Zero Green)
function generateSvg({ maskable = false } = {}) {
  // For maskable icons, the safe zone is within the center 80% circle (radius ~204 out of 256)
  const scale = maskable ? 0.8 : 1.0;
  const transform = maskable ? 'transform="translate(51.2, 51.2) scale(0.8)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Royal Fatimi Metallic Gold Gradients -->
    <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffef0" />
      <stop offset="15%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#eab308" />
      <stop offset="60%" stop-color="#d4af37" />
      <stop offset="85%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#78350f" />
    </linearGradient>

    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="20%" stop-color="#fde047" />
      <stop offset="50%" stop-color="#d4af37" />
      <stop offset="80%" stop-color="#b8860b" />
      <stop offset="100%" stop-color="#92400e" />
    </linearGradient>

    <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85" />
      <stop offset="50%" stop-color="#d4af37" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#b8860b" stop-opacity="0.75" />
    </linearGradient>

    <!-- Deep Midnight Obsidian & Warm Bronze Atmosphere (NO GREEN) -->
    <radialGradient id="midnightBg" cx="50%" cy="44%" r="72%">
      <stop offset="0%" stop-color="#2a1708" />
      <stop offset="35%" stop-color="#19120c" />
      <stop offset="70%" stop-color="#110e0b" />
      <stop offset="100%" stop-color="#080706" />
    </radialGradient>

    <!-- Golden Radial Ambient Halo -->
    <radialGradient id="ambientHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d4af37" stop-opacity="0.22" />
      <stop offset="50%" stop-color="#b45309" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- 3D Luxury Outer Drop Shadow -->
    <filter id="shadow3D" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.85" />
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#d4af37" flood-opacity="0.30" />
    </filter>

    <!-- Emblem Golden Glow Filter -->
    <filter id="emblemGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.9" />
      <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#d4af37" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Base Solid Background for Android & iOS Launchers -->
  <rect width="512" height="512" fill="#080706" />

  <g ${transform}>
    <!-- 3D Beveled Rounded Squircle Shield -->
    <rect
      x="12"
      y="12"
      width="488"
      height="488"
      rx="112"
      fill="url(#midnightBg)"
      stroke="url(#goldBorder)"
      stroke-width="4.5"
      filter="url(#shadow3D)"
    />

    <!-- Inset Delicate Bevel Hairline -->
    <rect
      x="22"
      y="22"
      width="468"
      height="468"
      rx="102"
      fill="none"
      stroke="url(#goldMetallic)"
      stroke-width="1.4"
      opacity="0.4"
    />

    <!-- Ambient Core Gold Illumination -->
    <circle cx="256" cy="256" r="210" fill="url(#ambientHalo)" />

    <!-- Sacred Geometry: Outer Concentric Solar Ring -->
    <circle
      cx="256"
      cy="256"
      r="192"
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="1.2"
      opacity="0.35"
    />

    <!-- Sacred Geometry: Celestial Tick Ring (32 Celestial Rays) -->
    <circle
      cx="256"
      cy="256"
      r="178"
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="2.5"
      stroke-dasharray="2 15"
      opacity="0.45"
    />

    <!-- Sacred Geometry: Rub-el-Hizb 8-Pointed Star Silhouette -->
    <!-- Interlocking Square 1 -->
    <rect
      x="128"
      y="128"
      width="256"
      height="256"
      rx="16"
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="1.8"
      opacity="0.35"
    />
    <!-- Interlocking Square 2 (45 degree diamond) -->
    <rect
      x="128"
      y="128"
      width="256"
      height="256"
      rx="16"
      transform="rotate(45 256 256)"
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="1.8"
      opacity="0.35"
    />

    <!-- Sacred Geometry: Starburst Vertex Polygon -->
    <polygon
      points="
        256,66 278,124 336,102 314,160 372,182 328,226 390,256
        328,286 372,330 314,352 336,410 278,388 256,446
        234,388 176,410 198,352 140,330 184,286 122,256
        184,226 140,182 198,160 176,102 234,124
      "
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="1.2"
      opacity="0.25"
    />

    <!-- Sacred Geometry: Inner Concentric Medallion Ring -->
    <circle
      cx="256"
      cy="256"
      r="138"
      fill="none"
      stroke="url(#goldFiligree)"
      stroke-width="1.5"
      opacity="0.4"
    />

    <!-- 4 Cardinal Ornaments (North, South, East, West) -->
    <!-- North Cardinal Diamond -->
    <g transform="translate(256, 36)">
      <polygon points="0,-10 6,0 0,10 -6,0" fill="url(#goldMetallic)" />
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </g>
    <!-- South Cardinal Diamond -->
    <g transform="translate(256, 476)">
      <polygon points="0,-10 6,0 0,10 -6,0" fill="url(#goldMetallic)" />
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </g>
    <!-- West Cardinal Diamond -->
    <g transform="translate(36, 256)">
      <polygon points="-10,0 0,6 10,0 0,-6" fill="url(#goldMetallic)" />
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </g>
    <!-- East Cardinal Diamond -->
    <g transform="translate(476, 256)">
      <polygon points="-10,0 0,6 10,0 0,-6" fill="url(#goldMetallic)" />
      <circle cx="0" cy="0" r="2" fill="#ffffff" />
    </g>

    <!-- Embedded Authentic Mahad al-Zahra Emblem Calligraphy -->
    <image
      href="data:image/png;base64,${b64Logo}"
      x="46"
      y="54"
      width="420"
      height="404"
      preserveAspectRatio="xMidYMid meet"
      filter="url(#emblemGoldGlow)"
    />
  </g>
</svg>`;
}

// 2. Generate Favicon SVG (simplified high-contrast for small tabs)
function generateFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <linearGradient id="favGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="30%" stop-color="#fde047" />
      <stop offset="60%" stop-color="#d4af37" />
      <stop offset="100%" stop-color="#92400e" />
    </linearGradient>
    <radialGradient id="favBg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#2a1708" />
      <stop offset="50%" stop-color="#16120e" />
      <stop offset="100%" stop-color="#0a0807" />
    </radialGradient>
  </defs>

  <!-- Beveled Squircle Base -->
  <rect x="3" y="3" width="122" height="122" rx="28" fill="url(#favBg)" stroke="url(#favGold)" stroke-width="2.5" />
  <rect x="7" y="7" width="114" height="114" rx="24" fill="none" stroke="#fde047" stroke-width="0.8" opacity="0.35" />

  <!-- Embedded Logo -->
  <image
    href="data:image/png;base64,${b64Logo}"
    x="12"
    y="14"
    width="104"
    height="100"
    preserveAspectRatio="xMidYMid meet"
  />
</svg>`;
}

// Write SVGs
const standardSvg = generateSvg({ maskable: false });
const maskableSvg = generateSvg({ maskable: true });
const faviconSvg = generateFaviconSvg();

fs.writeFileSync(path.join(clientPublicDir, 'apple-touch-icon.svg'), standardSvg, 'utf-8');
fs.writeFileSync(path.join(clientPublicDir, 'favicon.svg'), faviconSvg, 'utf-8');
console.log('Written client/public/apple-touch-icon.svg and favicon.svg');

if (fs.existsSync(clientDistDir)) {
  fs.writeFileSync(path.join(clientDistDir, 'apple-touch-icon.svg'), standardSvg, 'utf-8');
  fs.writeFileSync(path.join(clientDistDir, 'favicon.svg'), faviconSvg, 'utf-8');
  console.log('Written client/dist/apple-touch-icon.svg and favicon.svg');
}

// 3. Render PNGs using headless Edge / Chrome
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserExe = fs.existsSync(edgePath) ? edgePath : chromePath;
console.log('Using browser executable for rendering:', browserExe);

// Helper to render HTML to PNG
function renderSvgToPng(svgStr, targetSize, outputPath) {
  const tempHtmlPath = path.join(rootDir, `temp_render_${targetSize}.html`);
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${targetSize}px; height: ${targetSize}px; overflow: hidden; background: #080706; }
    svg { width: ${targetSize}px; height: ${targetSize}px; display: block; }
  </style>
</head>
<body>
  ${svgStr}
</body>
</html>`;

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

  try {
    const cmd = `"${browserExe}" --headless --disable-gpu --hide-scrollbars --window-size=${targetSize},${targetSize} --screenshot="${outputPath}" "${fileUrl}"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log(`Rendered ${path.basename(outputPath)} (${targetSize}x${targetSize}) -> ${fs.statSync(outputPath).size} bytes`);
  } finally {
    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
  }
}

// Render targets:
// Standard icons
renderSvgToPng(standardSvg, 512, path.join(clientPublicDir, 'pwa-512x512.png'));
renderSvgToPng(standardSvg, 192, path.join(clientPublicDir, 'pwa-192x192.png'));
renderSvgToPng(standardSvg, 512, path.join(clientPublicDir, 'apple-touch-icon.png'));
renderSvgToPng(standardSvg, 180, path.join(clientPublicDir, 'apple-touch-icon-180x180.png'));
renderSvgToPng(standardSvg, 512, path.join(clientPublicDir, 'apple-touch-icon-precomposed.png'));

// Maskable icon (safe area 80%)
renderSvgToPng(maskableSvg, 512, path.join(clientPublicDir, 'maskable-icon-512x512.png'));

// Favicons
renderSvgToPng(faviconSvg, 32, path.join(clientPublicDir, 'favicon-32x32.png'));
renderSvgToPng(faviconSvg, 16, path.join(clientPublicDir, 'favicon-16x16.png'));

// Copy to client/dist if dist exists
if (fs.existsSync(clientDistDir)) {
  const pngFiles = [
    'pwa-512x512.png',
    'pwa-192x192.png',
    'maskable-icon-512x512.png',
    'apple-touch-icon.png',
    'apple-touch-icon-180x180.png',
    'apple-touch-icon-precomposed.png',
    'favicon-32x32.png',
    'favicon-16x16.png',
  ];
  for (const f of pngFiles) {
    fs.copyFileSync(path.join(clientPublicDir, f), path.join(clientDistDir, f));
  }
  console.log('Copied all PNG icons to client/dist');
}

console.log('PWA Theme Icons successfully generated and verified!');

