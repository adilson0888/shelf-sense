// Regenerates apps/web/public/icons/* from public/brand/icon-tote-tile.svg.
// Run manually (`node scripts/generate-pwa-icons.mjs`) whenever that source
// SVG changes — output is committed, this isn't part of the build.
//
// "any"-purpose icons (and the apple touch icon) rasterize the source SVG
// as-is: it's already a full-bleed rounded tile, which is exactly what a
// normal home-screen icon should look like. The "maskable" icon is
// different on purpose — Android crops maskable icons to an arbitrary
// mask shape (circle, squircle, ...) and only guarantees the inner ~80%
// "safe zone" survives, whereas the source SVG's tote handles reach to
// x=7/57 of 64 (~78% of the width already), so used as-is they'd get
// clipped on some launchers. The maskable variant below instead paints a
// full-bleed square (no corner radius — the OS supplies its own) and
// scales the tote artwork down to fit inside that safe zone.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "..", "public");
const outDir = path.join(publicDir, "icons");
mkdirSync(outDir, { recursive: true });

const sourceSvg = readFileSync(path.join(publicDir, "brand", "icon-tote-tile.svg"), "utf8");

// Same tote artwork as icon-tote-tile.svg, minus its own rounded-rect
// background, scaled to ~70% and centered inside a fresh full-bleed
// square canvas.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#167d76"></rect>
  <g transform="translate(9.6 9.6) scale(0.7)">
    <rect x="14" y="20" width="36" height="30" rx="8" fill="#ffffff"></rect>
    <rect x="14" y="20" width="36" height="8" rx="4" fill="#a8e8e3"></rect>
    <rect x="7" y="31" width="7" height="6" rx="3" fill="#a8e8e3"></rect>
    <rect x="50" y="31" width="7" height="6" rx="3" fill="#a8e8e3"></rect>
    <circle cx="25" cy="37" r="3.6" fill="#167d76"></circle>
    <circle cx="39" cy="37" r="3.6" fill="#167d76"></circle>
    <rect x="27" y="44" width="10" height="3" rx="1.5" fill="#167d76"></rect>
  </g>
</svg>`;

const targets = [
  { file: "icon-192.png", svg: sourceSvg, size: 192 },
  { file: "icon-512.png", svg: sourceSvg, size: 512 },
  { file: "maskable-512.png", svg: maskableSvg, size: 512 },
  // iOS ignores alpha/rounding on apple-touch-icon and applies its own
  // squircle mask, same deal as a normal "any" icon — the full-bleed
  // source tile is the right shape for it too.
  { file: "apple-touch-icon.png", svg: sourceSvg, size: 180 },
];

for (const { file, svg, size } of targets) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file));
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}
