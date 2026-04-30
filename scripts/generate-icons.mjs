// Generates PWA icons from the PQW logo
// Run with: node scripts/generate-icons.mjs

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../public/cropped-PQW-Logo-RGB_resized-150px.jpg.webp');
const out = path.join(__dirname, '../public');

const BRAND = { r: 30, g: 18, b: 64, alpha: 1 }; // #1E1240

async function makeIcon(size) {
  // Logo takes up 70% of the icon, centered on brand-colour background
  const logoSize  = Math.round(size * 0.70);
  const pad       = Math.round((size - logoSize) / 2);

  const logo = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: BRAND })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(path.join(out, `icon-${size}.png`));

  console.log(`✓ icon-${size}.png`);
}

await makeIcon(192);
await makeIcon(512);
console.log('Icons generated in public/');
