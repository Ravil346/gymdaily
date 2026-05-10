/**
 * Генерирует PNG-иконки для PWA: 192×192, 512×512, 180×180 (apple-touch-icon).
 * Использует только встроенные модули Node.js — никаких зависимостей.
 *
 * Цвет: --accent #8b6fc7 (лавандовый)
 *
 * Запуск: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// ── CRC32 (нужен для PNG-чанков) ──────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBytes = Buffer.allocUnsafe(4);
  crcBytes.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBytes]);
}

// ── Генерация PNG с закруглёнными углами ─────────────────────────────────

function solidRoundedPNG(size, r, g, b, radius) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width, height, 8bit, RGBA (color type 6)
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Image data: filter byte (0) + RGBA per pixel
  const stride = 1 + size * 4;
  const raw = Buffer.allocUnsafe(size * stride);

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const offset = y * stride + 1 + x * 4;
      // Проверяем, внутри ли точка скруглённого прямоугольника
      const inside = isInsideRounded(x, y, size, radius);
      raw[offset]     = inside ? r : 0;
      raw[offset + 1] = inside ? g : 0;
      raw[offset + 2] = inside ? b : 0;
      raw[offset + 3] = inside ? 255 : 0; // alpha
    }
  }

  const compressed = deflateSync(raw);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function isInsideRounded(x, y, size, r) {
  // Проверяем четыре угловых круга
  const corners = [
    [r, r],
    [size - 1 - r, r],
    [r, size - 1 - r],
    [size - 1 - r, size - 1 - r],
  ];

  // Если точка в "квадратной" части — всегда внутри
  const inHStrip = x >= r && x <= size - 1 - r;
  const inVStrip = y >= r && y <= size - 1 - r;
  if (inHStrip || inVStrip) return true;

  // Иначе проверяем расстояние до ближайшего угла
  for (const [cx, cy] of corners) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// ── Запись иконок ─────────────────────────────────────────────────────────

mkdirSync('public/icons', { recursive: true });

const [R, G, B] = [0x8b, 0x6f, 0xc7]; // #8b6fc7

writeFileSync('public/icons/icon-192.png',         solidRoundedPNG(192, R, G, B, 40));
writeFileSync('public/icons/icon-512.png',         solidRoundedPNG(512, R, G, B, 100));
writeFileSync('public/icons/apple-touch-icon.png', solidRoundedPNG(180, R, G, B, 40));

console.log('✓ Icons generated: public/icons/');
