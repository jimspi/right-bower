// Generates all PWA / favicon / social assets from public/logo.svg.
// Usage: npm run icons
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const svg = fs.readFileSync(path.join(pub, "logo.svg"), "utf8");

const render = (src, size) =>
  sharp(Buffer.from(src), { density: 384 }).resize(size, size).png();

const out = (name, pipeline) => pipeline.toFile(path.join(pub, name));

// Standard icons (full-bleed square, no rounded corners, no transparency).
await out("icon-16.png", render(svg, 16));
await out("icon-32.png", render(svg, 32));
await out("icon-192.png", render(svg, 192));
await out("icon-512.png", render(svg, 512));
await out("apple-touch-icon.png", render(svg, 180).flatten({ background: "#0f4430" }).removeAlpha());

// Maskable icon: shrink the mark into the central safe zone (~80%).
const maskable = svg.replace('scale(1)', "scale(0.74)");
await out("icon-maskable-512.png", render(maskable, 512));

// favicon.ico (16/32/48)
const sizes = [16, 32, 48];
const bufs = await Promise.all(sizes.map((s) => render(svg, s).toBuffer()));
fs.writeFileSync(path.join(pub, "favicon.ico"), await pngToIco(bufs));
fs.copyFileSync(path.join(pub, "favicon.ico"), path.join(root, "app", "favicon.ico"));

// Open Graph image 1200x630: logo on the left, title on the right.
const logoPng = await render(svg, 400).toBuffer();
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="bg" cx="30%" cy="40%" r="90%">
      <stop offset="0" stop-color="#1f7a55"/><stop offset="0.6" stop-color="#0f4430"/><stop offset="1" stop-color="#06201a"/>
    </radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9a4"/><stop offset="1" stop-color="#c79a2e"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="520" y="300" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="92" fill="url(#g)">Right Bower</text>
  <text x="524" y="368" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#fbf6e9">Single-player Euchre for your phone</text>
  <text x="524" y="426" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#e3b94e">Play offline. Add to Home Screen.</text>
</svg>`);
await sharp(og)
  .composite([{ input: logoPng, left: 70, top: 115 }])
  .png()
  .toFile(path.join(pub, "og-image.png"));

console.log("Icons generated.");
