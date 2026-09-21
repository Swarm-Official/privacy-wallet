// Draws the placeholder SWARM application icon.
//
// The owner has not chosen a final logo. This renders the hex-bee mark from
// the website's assets/logo-mark.svg — the same geometry, the same colours —
// into resources/swarm/icon.png and resources/swarm/icon.ico, which are the
// only two files the packaged wallet's icon comes from. Replacing the logo
// later means replacing those two files (or re-running this script against a
// new set of shapes); nothing else refers to the artwork.
//
// It is written by hand because this machine has no SVG rasteriser and none
// may be installed. The shapes are all polygons, so a scanline fill with 4x4
// supersampling is enough, and zlib plus a CRC are enough to write a PNG.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 256;
const SUPERSAMPLE = 4;
const CANVAS = SIZE * SUPERSAMPLE;
// The source artwork is drawn on a 64x64 viewBox.
const VIEWBOX = 64;
const SCALE = CANVAS / VIEWBOX;

const HONEY = [0xf5, 0xa6, 0x23];
const WING = [0xff, 0xc9, 0x4d];
const STINGER = [0xe8, 0x89, 0x0c];
const STRIPE = [0x0e, 0x11, 0x16];

const rotate = (points, degrees, cx, cy) => {
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return points.map(([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]);
};

const rect = (x, y, width, height) => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

// Every shape in the mark, in the order the SVG paints them.
const BODY = [
  [32, 15.5],
  [45.856, 23.5],
  [45.856, 39.5],
  [32, 47.5],
  [18.144, 39.5],
  [18.144, 23.5],
];
const LEFT_WING = rotate(
  [
    [16.6, 12.8],
    [24.221, 17.2],
    [24.221, 26],
    [16.6, 30.4],
    [8.979, 26],
    [8.979, 17.2],
  ],
  -20,
  16.6,
  21.6,
);
const RIGHT_WING = rotate(
  [
    [47.4, 12.8],
    [55.021, 17.2],
    [55.021, 26],
    [47.4, 30.4],
    [39.779, 26],
    [39.779, 17.2],
  ],
  20,
  47.4,
  21.6,
);
const SHAPES = [
  { points: [[28.8, 44], [35.2, 44], [32, 51.3]], color: STINGER, alpha: 1, clip: null },
  { points: LEFT_WING, color: WING, alpha: 0.92, clip: null },
  { points: RIGHT_WING, color: WING, alpha: 0.92, clip: null },
  { points: BODY, color: HONEY, alpha: 1, clip: null },
  { points: rect(16, 21.5, 32, 4.4), color: STRIPE, alpha: 1, clip: BODY },
  { points: rect(16, 34.1, 32, 4.4), color: STRIPE, alpha: 1, clip: BODY },
];

/** Whether (x, y) is inside a polygon, by the even-odd rule. */
const inside = (points, x, y) => {
  let within = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
};

const bounds = (points) => ({
  minX: Math.max(0, Math.floor(Math.min(...points.map((p) => p[0])) * SCALE)),
  maxX: Math.min(CANVAS - 1, Math.ceil(Math.max(...points.map((p) => p[0])) * SCALE)),
  minY: Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])) * SCALE)),
  maxY: Math.min(CANVAS - 1, Math.ceil(Math.max(...points.map((p) => p[1])) * SCALE)),
});

const canvas = Buffer.alloc(CANVAS * CANVAS * 4);

for (const shape of SHAPES) {
  const box = bounds(shape.points);
  for (let py = box.minY; py <= box.maxY; py += 1) {
    const y = (py + 0.5) / SCALE;
    for (let px = box.minX; px <= box.maxX; px += 1) {
      const x = (px + 0.5) / SCALE;
      if (!inside(shape.points, x, y)) continue;
      if (shape.clip && !inside(shape.clip, x, y)) continue;
      const at = (py * CANVAS + px) * 4;
      // Source-over, against whatever is already there.
      const source = shape.alpha;
      const destination = (canvas[at + 3] / 255) * (1 - source);
      const out = source + destination;
      for (let channel = 0; channel < 3; channel += 1) {
        canvas[at + channel] = Math.round(
          (shape.color[channel] * source + canvas[at + channel] * destination) / out,
        );
      }
      canvas[at + 3] = Math.round(out * 255);
    }
  }
}

// Box-downsample the supersampled canvas, averaging in premultiplied space so
// the edges of a shape do not bleed the colour of a transparent neighbour.
const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let [red, green, blue, alpha] = [0, 0, 0, 0];
    for (let dy = 0; dy < SUPERSAMPLE; dy += 1) {
      for (let dx = 0; dx < SUPERSAMPLE; dx += 1) {
        const at = ((y * SUPERSAMPLE + dy) * CANVAS + x * SUPERSAMPLE + dx) * 4;
        const a = canvas[at + 3] / 255;
        red += canvas[at] * a;
        green += canvas[at + 1] * a;
        blue += canvas[at + 2] * a;
        alpha += a;
      }
    }
    const at = (y * SIZE + x) * 4;
    if (alpha > 0) {
      pixels[at] = Math.round(red / alpha);
      pixels[at + 1] = Math.round(green / alpha);
      pixels[at + 2] = Math.round(blue / alpha);
    }
    pixels[at + 3] = Math.round((alpha / (SUPERSAMPLE * SUPERSAMPLE)) * 255);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // colour type: RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// A Vista-era .ico: one 256x256 entry holding the PNG as-is. 0 in the width
// and height bytes means 256, which is the only value they cannot hold.
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico[6] = 0;
ico[7] = 0;
ico[8] = 0; // colours in palette
ico[9] = 0; // reserved
ico.writeUInt16LE(1, 10); // colour planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);

const directory = path.resolve(__dirname, "../resources/swarm");
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, "icon.png"), png);
fs.writeFileSync(path.join(directory, "icon.ico"), Buffer.concat([ico, png]));
// The same mark inside the application, beside the version string.
fs.writeFileSync(path.resolve(__dirname, "../src/assets/img/swarm-mark.png"), png);
console.log(
  `Wrote the placeholder SWARM mark (${SIZE}x${SIZE}) to resources/swarm/icon.png, ` +
    "resources/swarm/icon.ico and src/assets/img/swarm-mark.png.",
);
