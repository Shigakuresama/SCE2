#!/usr/bin/env node

/**
 * Generate placeholder icons for SCE2 extension
 *
 * This script creates simple PNG icons using canvas.
 * For production, replace these with properly designed icons.
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Note: This requires the 'canvas' package: npm install --save-dev canvas
// If not available, the script will exit gracefully

let canvas;

try {
  // eslint-disable-next-line global-require
  canvas = require('canvas');
} catch (error) {
  console.error('Canvas module not found. Install with: npm install --save-dev canvas');
  console.error('For now, creating placeholder README in icons/ directory...');
  createPlaceholderReadme();
  process.exit(0);
}

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

sizes.forEach((size) => {
  const c = canvas.createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Background - blue gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#1976d2');
  gradient.addColorStop(1, '#1565c0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size / 16;
  ctx.strokeRect(size / 8, size / 8, (size * 3) / 4, (size * 3) / 4);

  // "SCE" text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size / 3}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCE', size / 2, size / 2);

  // Save as PNG
  const buffer = c.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Created: ${filename}`);
});

console.log('Icons generated successfully!');

function createPlaceholderReadme() {
  const iconsDir = path.join(__dirname, '..', 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const readmeContent = `# SCE2 Extension Icons

This directory should contain the following PNG files:

- icon16.png - 16x16 pixels
- icon48.png - 48x48 pixels
- icon128.png - 128x128 pixels

## How to Create Icons

### Option 1: Use the generate-icons script

\`\`\`bash
npm install --save-dev canvas
node scripts/generate-icons.js
\`\`\`

### Option 2: Manual Creation

1. Use any image editor (GIMP, Photoshop, Figma, etc.)
2. Create three square PNG images: 16x16, 48x48, and 128x128 pixels
3. Save them as icon16.png, icon48.png, and icon128.png in this directory
4. Recommended design: Blue background with white "SCE" text

### Option 3: Use Online Tools

- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- https://www.icoconverter.com/

## Current Status

Icons are not yet generated. The extension will still work,
but will show the default Chrome puzzle piece icon.
`;

  fs.writeFileSync(path.join(iconsDir, 'README.md'), readmeContent);
  console.log('Created icons/README.md with instructions');
}
