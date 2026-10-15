/**
 * Renders the app icons (home screen, splash, Apple touch icon) from one SVG:
 * the wordmark's neon crown on the night background. Run after changing the
 * design; the PNGs are committed. Usage: tsx scripts/build-icons.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const OUT = path.resolve(import.meta.dirname, "../public/icons");

/** `crown` is the crown's width as a share of the icon (maskable icons need it inside the safe zone). */
function svg(crown: number) {
  // The crown path is 30 wide (x 1–31) and 24 tall (y 1–25) in the wordmark's 32×26 box.
  const scale = (512 * crown) / 30;
  const x = 256 - 16 * scale;
  const y = 256 - 13 * scale + 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="0.3" cy="0.15" r="1">
      <stop offset="0" stop-color="#14251f"/>
      <stop offset="0.55" stop-color="#0d0a16"/>
      <stop offset="1" stop-color="#07040d"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#2ee6a6" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#2ee6a6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="crown" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#2ee6a6"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${6 * crown * 2}"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="262" r="${512 * crown * 0.85}" fill="url(#glow)"/>
  <g transform="translate(${x} ${y}) scale(${scale})">
    <g filter="url(#blur)" opacity="0.7">
      <path d="M3 20 1 5l8.5 7L16 1l6.5 11L31 5l-2 15Z" fill="url(#crown)"/>
      <rect x="3" y="21.5" width="26" height="3.5" rx="1.75" fill="url(#crown)"/>
    </g>
    <path d="M3 20 1 5l8.5 7L16 1l6.5 11L31 5l-2 15Z" fill="url(#crown)"/>
    <rect x="3" y="21.5" width="26" height="3.5" rx="1.75" fill="url(#crown)"/>
    <circle cx="16" cy="13.5" r="2" fill="#0a0710" opacity="0.55"/>
  </g>
</svg>`;
}

const ICONS = [
  { file: "icon-192.png", size: 192, crown: 0.56 },
  { file: "icon-512.png", size: 512, crown: 0.56 },
  // Maskable: launchers crop to a circle or squircle, so keep the crown in the middle 60%.
  { file: "icon-maskable-512.png", size: 512, crown: 0.46 },
  { file: "apple-touch-icon.png", size: 180, crown: 0.56 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { file, size, crown } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:#07040d}svg{display:block;width:${size}px;height:${size}px}</style>${svg(crown)}`,
    );
    await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
    console.log(`icons: ${file}`);
  }
  await browser.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
