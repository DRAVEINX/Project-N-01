import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const output = join(process.cwd(), "desktop", "build", "icon.ico");
const size = 256;
const pixels = Buffer.alloc(size * size * 4);

function roundedRect(x, y, w, h, radius, px, py) {
  const cx = Math.max(x + radius, Math.min(px, x + w - radius));
  const cy = Math.max(y + radius, Math.min(py, y + h - radius));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3] ?? 255;
}

function paintRounded(x, y, w, h, radius, colorFn) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (roundedRect(x, y, w, h, radius, px + 0.5, py + 0.5)) {
        setPixel(px, py, colorFn(px, py));
      }
    }
  }
}

paintRounded(0, 0, size, size, 48, () => [6, 17, 40, 255]);
paintRounded(16, 16, 224, 224, 44, (x, y) => {
  const t = Math.max(0, Math.min(1, (x + y - 32) / 448));
  return [
    Math.round(16 * (1 - t) + 12 * t),
    Math.round(43 * (1 - t) + 27 * t),
    Math.round(99 * (1 - t) + 67 * t),
    255
  ];
});

function paintLine(x1, y1, x2, y2, width, colorFn) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width));
  const vx = x2 - x1, vy = y2 - y1;
  const lengthSquared = vx * vx + vy * vy;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - x1) * vx + (y + 0.5 - y1) * vy) / lengthSquared));
      const dx = x + 0.5 - (x1 + t * vx);
      const dy = y + 0.5 - (y1 + t * vy);
      if (dx * dx + dy * dy <= width * width / 4) setPixel(x, y, colorFn(t, x, y));
    }
  }
}

function fillPolygon(points, colorFn) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...points.map(p => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        const crosses = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (crosses) inside = !inside;
      }
      if (inside) setPixel(x, y, colorFn(x, y));
    }
  }
}

paintLine(77, 184, 77, 75, 25, () => [45, 221, 245, 255]);
paintLine(77, 75, 177, 184, 25, (t) => [
  Math.round(38 * (1 - t) + 21 * t),
  Math.round(183 * (1 - t) + 139 * t),
  Math.round(255 * (1 - t) + 255 * t),
  255
]);
paintLine(177, 184, 177, 75, 25, () => [146, 91, 255, 255]);
fillPolygon([[151, 89], [163, 63], [185, 49], [211, 51], [205, 78], [188, 99], [166, 105], [156, 100]], (x, y) => {
  const t = Math.max(0, Math.min(1, (y - 49) / 56));
  return [Math.round(119 * (1 - t)), Math.round(255 * (1 - t) + 198 * t), Math.round(213 * (1 - t) + 170 * t), 255];
});
paintLine(164, 96, 201, 60, 4, () => [5, 67, 81, 255]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

const raw = Buffer.alloc(size * (1 + size * 4));
for (let y = 0; y < size; y++) {
  const rowStart = y * (1 + size * 4);
  raw[rowStart] = 0;
  pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", (() => {
    const h = Buffer.alloc(13);
    h.writeUInt32BE(size, 0);
    h.writeUInt32BE(size, 4);
    h[8] = 8; h[9] = 6; h[10] = 0; h[11] = 0; h[12] = 0;
    return h;
  })()),
  pngChunk("IDAT", deflateSync(raw)),
  pngChunk("IEND", Buffer.alloc(0))
]);

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 0; header[7] = 0; header[8] = 0; header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([header, png]));
console.log("Generated Windows ICO:", output, "(" + (await (await import("node:fs/promises")).stat(output)).size + " bytes)");
