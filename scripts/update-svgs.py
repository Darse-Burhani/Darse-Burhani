import base64

with open('client/public/logo.png', 'rb') as f:
    b64_logo = base64.b64encode(f.read()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="bgGradient" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#065f46" />
      <stop offset="50%" stop-color="#022c22" />
      <stop offset="100%" stop-color="#01120e" />
    </radialGradient>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#d4af37" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Base Rounded Rectangle for App Icon Preview -->
  <rect x="8" y="8" width="496" height="496" rx="110" fill="url(#bgGradient)" stroke="#d4af37" stroke-width="4" />

  <!-- Inner Soft Glow -->
  <circle cx="256" cy="256" r="200" fill="#d4af37" opacity="0.08" />

  <!-- Embedded Authentic Mahad al Zahra Logo -->
  <image href="data:image/png;base64,{b64_logo}" x="38" y="38" width="436" height="436" preserveAspectRatio="xMidYMid meet" filter="url(#goldGlow)" />
</svg>'''

with open('client/public/apple-touch-icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,{b64_logo}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>'''

with open('client/public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(favicon_svg)

print('SVGs updated with embedded logo successfully.')
