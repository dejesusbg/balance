// Generates every app icon from assets/icon.svg. Run: npm run icons
//  - maskable + Apple touch: full-bleed square (the OS applies its own shape)
//  - "any" PNGs and the favicon: same artwork on a rounded square
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const fullBleed = readFileSync("assets/icon.svg", "utf8");
const rounded = fullBleed.replace('<rect width="512" height="512"', '<rect width="512" height="512" rx="112"');

const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(rounded, 192));
writeFileSync("public/icons/icon-512.png", png(rounded, 512));
writeFileSync("public/icons/maskable-512.png", png(fullBleed, 512));
writeFileSync("public/icons/apple-touch-icon.png", png(fullBleed, 180));
// Next.js serves app/icon.svg as the favicon.
writeFileSync("src/app/icon.svg", rounded);
console.log("icons written: public/icons/*, src/app/icon.svg");
