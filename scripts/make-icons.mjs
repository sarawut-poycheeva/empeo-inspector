/**
 * Draws the toolbar icons.
 *
 * A generator rather than four checked-in PNGs, because a binary nobody can
 * regenerate is a binary nobody can change: the brand colour moves and the icon
 * silently stays wrong. Everything here is derived from the same two values the
 * popup's own logo uses, so they cannot drift apart.
 *
 * PNG is written by hand — Chrome will not take an SVG for `action.default_icon`,
 * and pulling in an image library to draw two circles is not a trade worth making.
 *
 * Run: npm run icons
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

/** Same gradient as `.logo` in popup.css. */
const FROM = [0xf0, 0x5b, 0x2f];
const TO = [0x7d, 0x2e, 0xf0];

const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor — the only anti-aliasing available here

// ---------- PNG ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(buffer) {
	let c = 0xffffffff;
	for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);

	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));

	return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA

	// Every scanline carries a leading filter byte; 0 means "none".
	const raw = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++) {
		const at = y * (size * 4 + 1);
		raw[at] = 0;
		rgba.copy(raw, at + 1, y * size * 4, (y + 1) * size * 4);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// ---------- the mark ----------

/** Signed distance to a rounded square covering the whole tile. */
function insideTile(x, y, size, radius) {
	const dx = Math.max(radius - x, x - (size - radius), 0);
	const dy = Math.max(radius - y, y - (size - radius), 0);
	return Math.hypot(dx, dy) <= radius;
}

/**
 * A lens: ring plus handle. Deliberately fat-stroked — at 16px a hairline ring
 * disappears into the toolbar, and 16px is the size that actually gets looked at.
 */
function insideLens(x, y, size) {
	const cx = size * 0.44;
	const cy = size * 0.42;
	const r = size * 0.2;
	const stroke = size * 0.088;

	const d = Math.hypot(x - cx, y - cy);
	if (Math.abs(d - r) <= stroke / 2) return true;

	// handle: a thick segment running out from the ring at 45°
	const ax = cx + Math.cos(Math.PI / 4) * r;
	const ay = cy + Math.sin(Math.PI / 4) * r;
	const bx = cx + Math.cos(Math.PI / 4) * (r + size * 0.22);
	const by = cy + Math.sin(Math.PI / 4) * (r + size * 0.22);

	const vx = bx - ax;
	const vy = by - ay;
	const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
	return Math.hypot(x - (ax + t * vx), y - (ay + t * vy)) <= stroke / 2;
}

function draw(size) {
	const out = Buffer.alloc(size * size * 4);
	const radius = size * 0.22;

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let tile = 0;
			let lens = 0;

			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const px = x + (sx + 0.5) / SS;
					const py = y + (sy + 0.5) / SS;
					if (insideTile(px, py, size, radius)) tile++;
					if (insideLens(px, py, size)) lens++;
				}
			}

			const samples = SS * SS;
			const tileA = tile / samples;
			const lensA = (lens / samples) * tileA; // the mark cannot spill past the tile

			// 135deg, matching `linear-gradient(135deg, …)`: along the x+y diagonal
			const g = (x + y) / (2 * size);
			const base = FROM.map((from, i) => Math.round(from + (TO[i] - from) * g));

			// white mark composited over the gradient, then the whole tile masked
			const at = (y * size + x) * 4;
			for (let i = 0; i < 3; i++) out[at + i] = Math.round(base[i] * (1 - lensA) + 255 * lensA);
			out[at + 3] = Math.round(tileA * 255);
		}
	}

	return out;
}

mkdirSync("icons", { recursive: true });

for (const size of SIZES) {
	const file = `icons/icon${size}.png`;
	writeFileSync(file, png(size, draw(size)));
	console.log(`✓ ${file}`);
}
