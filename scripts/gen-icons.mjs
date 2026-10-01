// Placeholder PWA icons (solid background + centered circle) until the
// design system's logo is available. Run: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x82, 0x0a, 0xd1]; // brand purple
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, circleRatio) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const c = size / 2, rad = size * circleRatio;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const inside = (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= rad ** 2;
      const px = inside ? FG : BG;
      px.forEach((v, i) => (raw[y * (size * 3 + 1) + 1 + x * 3 + i] = v));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, 0.3));
writeFileSync("public/icons/icon-512.png", png(512, 0.3));
// Maskable: keep the shape inside the 80% safe zone.
writeFileSync("public/icons/maskable-512.png", png(512, 0.22));
writeFileSync("public/icons/apple-touch-icon.png", png(180, 0.3));
console.log("icons written to public/icons");
