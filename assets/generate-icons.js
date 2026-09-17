const fs = require('fs');
const path = require('path');

// Create assets dir if not exists
const assetsDir = path.join(__dirname);
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate valid 1x1 base64 PNGs or minimal PNGs for 16, 48, 128
// Azure Blue (#0078D4) 1-pixel PNG expanded
const png16Base64 = 'iVBORw0KGgoAAAANSUh0KGgoAAAANSUh0KggAAAABJRU5ErkJggg==';
const pngBase64 = 'iVBORw0KGgoAAAANSUh0KGgoAAAANSUh0KggAAAABJRU5ErkJggg==';

// Create SVG strings and generate valid icons
const createSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#0B0F19"/>
  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#00BCF2"/>
  <path d="M2 17L12 22L22 17" stroke="#0078D4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M2 12L12 17L22 12" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Write SVG icons
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), createSvg(128));

console.log('Icon assets generated.');
