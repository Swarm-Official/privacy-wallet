// Draws the SWARM application icon: the style guide's hive bee.
//
// The mark is defined in D:\privacy\Style guide\Swarm Style Guide v2.dc.html,
// section 02: a hexagonal body — one cell of the hive — in Hive Orange, two
// stripes that take the background colour, and two honey elliptical wings.
// The geometry here is that SVG's, unchanged. The icon uses the guide's
// "full-colour on dark" variant on a warm-black rounded tile, which is what
// the guide itself shows an app icon as, and keeps the stripes readable
// against whatever the desktop puts behind it.
//
// Outputs are resources/swarm/icon.png, resources/swarm/icon.ico and
// src/assets/img/swarm-mark.png. Those three files are the only artwork the
// wallet ships; changing the mark means re-running this script.
//
// It is written by hand because this machine has no SVG rasteriser and none
// may be installed. The shapes are polygons and ellipses, so a scanline fill
// with 4x4 supersampling is enough, and zlib plus a CRC are enough for a PNG.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SUPERSAMPLE = 4;

// Filled in per render by `renderPng`; the drawing below reads them the way
// it always did, so the shapes needed no rewriting to gain more sizes.
let SIZE = 256;
let CANVAS = SIZE * SUPERSAMPLE;
// The source artwork is drawn on a 64x64 viewBox.
const VIEWBOX = 64;
let SCALE = CANVAS / VIEWBOX;

const HIVE_ORANGE = [0xff, 0x8a, 0x1f];
const HONEY = [0xff, 0xb0, 0x20];
const WARM_BLACK = [0x0a, 0x09, 0x08];

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

// An ellipse as a polygon, fine enough that its edge is smooth once the
// canvas is downsampled. `rx`, `ry` and the rotation are the SVG's.
const ellipse = (cx, cy, rx, ry, degrees) => {
  const STEPS = 96;
  return rotate(
    Array.from({ length: STEPS }, (_, i) => {
      const angle = (i / STEPS) * 2 * Math.PI;
      return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
    }),
    degrees,
    cx,
    cy,
  );
};

// A rounded square the mark sits on, so the stripes — which take the
// background colour — stay legible on any desktop wallpaper.
const roundedTile = (radius) => {
  const STEPS = 24;
  const [lo, hi] = [0, VIEWBOX];
  const corner = (cx, cy, from) =>
    Array.from({ length: STEPS + 1 }, (_, i) => {
      const angle = from + (i / STEPS) * (Math.PI / 2);
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
  return [
    ...corner(hi - radius, hi - radius, 0),
    ...corner(lo + radius, hi - radius, Math.PI / 2),
    ...corner(lo + radius, lo + radius, Math.PI),
    ...corner(hi - radius, lo + radius, (3 * Math.PI) / 2),
  ];
};

// The mark, in the order the style guide's SVG paints it.
const BODY = [
  [32, 22],
  [46, 30],
  [46, 48],
  [32, 56],
  [18, 48],
  [18, 30],
];
const SHAPES = [
  { points: roundedTile(13), color: WARM_BLACK, alpha: 1, clip: null },
  { points: ellipse(21, 17, 12, 6.5, -28), color: HONEY, alpha: 1, clip: null },
  { points: ellipse(43, 17, 12, 6.5, 28), color: HONEY, alpha: 1, clip: null },
  { points: BODY, color: HIVE_ORANGE, alpha: 1, clip: null },
  { points: rect(18, 35, 28, 4), color: WARM_BLACK, alpha: 1, clip: BODY },
  { points: rect(18, 44, 28, 4), color: WARM_BLACK, alpha: 1, clip: BODY },
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

/** The mark as a PNG of `size` pixels square. */
function renderPng(size) {
  SIZE = size;
  CANVAS = SIZE * SUPERSAMPLE;
  SCALE = CANVAS / VIEWBOX;

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
  return png;
}

const png = renderPng(256);

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
const linuxIcons = path.join(directory, "icons");
fs.mkdirSync(linuxIcons, { recursive: true });
fs.writeFileSync(path.join(directory, "icon.png"), png);
fs.writeFileSync(path.join(directory, "icon.ico"), Buffer.concat([ico, png]));
// The same mark inside the application, beside the version string.
fs.writeFileSync(path.resolve(__dirname, "../src/assets/img/swarm-mark.png"), png);

// Linux takes a directory of PNGs named by size; electron-builder picks
// what each target needs. macOS takes the 1024 and converts it to an icns
// on the runner, which is the only place the conversion tooling exists.
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
for (const size of sizes) {
  fs.writeFileSync(path.join(linuxIcons, `${size}x${size}.png`), renderPng(size));
}
fs.copyFileSync(path.join(linuxIcons, "1024x1024.png"), path.join(directory, "icon-1024.png"));

console.log(
  `Wrote the SWARM hive-bee mark to resources/swarm: icon.png and icon.ico (256), ` +
    `icon-1024.png for macOS, icons/ at ${sizes.join(', ')} for Linux, ` +
    `and src/assets/img/swarm-mark.png.`,
);
