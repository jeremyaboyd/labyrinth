// ---- procedural 64x64 wall/floor textures, DOS palette flavor ----
'use strict';

const TEX_SIZE = 64;

// Texture ids used in the map grid
const T_STONE = 1;
const T_MOSS = 2;
const T_RUNE = 3;
const T_BANNER = 4;
const T_SKULL = 5;
const T_DOOR = 8;
const T_DOOR_LOCKED = 9;
// non-map textures
const T_FLOOR = 100;
const T_CEIL = 101;

const Textures = {}; // id -> {data: Uint32Array, w, h}

function texPut(px, x, y, r, g, b) {
  px[y * TEX_SIZE + x] = rgb(post(r), post(g), post(b));
}

function genNoiseGrid(rng, n, amp) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = (rng() - 0.5) * amp;
  return g;
}

// base stone bricks; returns raw float shade array + brick id map for tinting
function genBrickBase(rng) {
  const shade = new Float32Array(TEX_SIZE * TEX_SIZE);
  const brickTint = new Float32Array(TEX_SIZE * TEX_SIZE);
  const BH = 16, BW = 32;
  for (let y = 0; y < TEX_SIZE; y++) {
    const row = Math.floor(y / BH);
    for (let x = 0; x < TEX_SIZE; x++) {
      const off = (row % 2) * (BW / 2);
      const bx = Math.floor(((x + off) % TEX_SIZE) / BW);
      const inBx = (x + off) % BW;
      const inBy = y % BH;
      // per-brick tint (stable pseudo-random from brick coords)
      const bid = row * 7 + bx * 13;
      const t = Math.sin(bid * 12.9898) * 43758.5453;
      brickTint[y * TEX_SIZE + x] = (t - Math.floor(t) - 0.5) * 0.22;
      // mortar lines
      let s = 1.0;
      if (inBy < 1 || inBy > BH - 2) s = 0.45;
      else if (inBx < 1 || inBx > BW - 2) s = 0.45;
      else {
        // beveled edge highlight
        if (inBy === 1 || inBx === 1) s = 1.15;
        if (inBy === BH - 2 || inBx === BW - 2) s = 0.8;
      }
      shade[y * TEX_SIZE + x] = s + (rng() - 0.5) * 0.14;
    }
  }
  // cracks: random walks
  for (let c = 0; c < 5; c++) {
    let x = rngInt(rng, 4, TEX_SIZE - 5), y = rngInt(rng, 0, TEX_SIZE - 1);
    const len = rngInt(rng, 6, 18);
    for (let i = 0; i < len; i++) {
      shade[((y + TEX_SIZE) % TEX_SIZE) * TEX_SIZE + ((x + TEX_SIZE) % TEX_SIZE)] *= 0.55;
      x += rngInt(rng, -1, 1); y += 1;
      if (y >= TEX_SIZE) break;
    }
  }
  return { shade, brickTint };
}

function buildTexture(id, fn) {
  const px = new Uint32Array(TEX_SIZE * TEX_SIZE);
  fn(px);
  Textures[id] = { data: px, w: TEX_SIZE, h: TEX_SIZE };
}

function generateTextures(seed) {
  const rng = makeRng(seed);

  // -- plain stone --
  const base = genBrickBase(rng);
  buildTexture(T_STONE, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(base.shade[i] + base.brickTint[i], 0.2, 1.4);
      texPut(px, x, y, 108 * s, 100 * s, 92 * s);
    }
  });

  // -- mossy stone --
  const base2 = genBrickBase(rng);
  buildTexture(T_MOSS, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(base2.shade[i] + base2.brickTint[i], 0.2, 1.4);
      texPut(px, x, y, 100 * s, 96 * s, 88 * s);
    }
    // moss blobs
    for (let m = 0; m < 26; m++) {
      const mx = rngInt(rng, 0, TEX_SIZE - 1), my = rngInt(rng, 0, TEX_SIZE - 1);
      const rr = rngInt(rng, 2, 6);
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        if (rng() < 0.35) continue;
        const x = (mx + dx + TEX_SIZE) % TEX_SIZE, y = (my + dy + TEX_SIZE) % TEX_SIZE;
        const s = 0.7 + rng() * 0.5;
        texPut(px, x, y, 40 * s, 90 * s, 36 * s);
      }
    }
  });

  // -- rune block: dark stone + glowing cyan rune --
  const base3 = genBrickBase(rng);
  buildTexture(T_RUNE, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(base3.shade[i] * 0.6 + base3.brickTint[i], 0.15, 1.0);
      texPut(px, x, y, 70 * s, 68 * s, 78 * s);
    }
    // rune: angular glyph strokes
    const strokes = [
      [32, 12, 32, 52], [32, 12, 20, 26], [32, 12, 44, 26],
      [20, 40, 44, 40], [24, 52, 40, 52],
    ];
    for (const [x0, y0, x1, y1] of strokes) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(lerp(x0, x1, i / steps));
        const y = Math.round(lerp(y0, y1, i / steps));
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const gx = x + dx, gy = y + dy;
          if (gx < 0 || gy < 0 || gx >= TEX_SIZE || gy >= TEX_SIZE) continue;
          const core = (dx === 0 && dy === 0);
          const c = core ? [90, 240, 220] : [30, 110, 105];
          const idx = gy * TEX_SIZE + gx;
          const old = px[idx];
          if (!core && ((old >> 8) & 255) > 100) continue;
          texPut(px, gx, gy, c[0], c[1], c[2]);
        }
      }
    }
  });

  // -- banner block: stone with hanging red banner --
  const base4 = genBrickBase(rng);
  buildTexture(T_BANNER, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(base4.shade[i] + base4.brickTint[i], 0.2, 1.4);
      texPut(px, x, y, 108 * s, 100 * s, 92 * s);
    }
    for (let y = 2; y < 58; y++) {
      // banner narrows to a point at bottom
      let half = 12;
      if (y > 46) half = Math.max(0, 12 - (y - 46));
      for (let x = 32 - half; x <= 32 + half; x++) {
        const fold = Math.sin(x * 0.7) * 0.12;
        let s = 0.85 + fold + (y < 6 ? 0.2 : 0);
        let r = 150 * s, g = 30 * s, b = 34 * s;
        // gold trim
        if (Math.abs(x - 32) === half || y === 2 || (y > 46 && Math.abs(x - 32) === half)) {
          r = 190; g = 150; b = 40;
        }
        texPut(px, x, y, r, g, b);
      }
    }
    // gold emblem diamond
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 5) continue;
      const s = 1 - Math.abs(dy) * 0.06;
      texPut(px, 32 + dx, 22 + dy, 200 * s, 160 * s, 46 * s);
    }
  });

  // -- skull niche block: stone with a carved skull alcove --
  const base5 = genBrickBase(rng);
  buildTexture(T_SKULL, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(base5.shade[i] + base5.brickTint[i], 0.2, 1.4);
      texPut(px, x, y, 104 * s, 98 * s, 90 * s);
    }
    // dark alcove
    for (let y = 16; y < 52; y++) for (let x = 18; x < 47; x++) {
      const edge = (y < 19 || y > 48 || x < 21 || x > 43) ? 0.5 : 0.22;
      texPut(px, x, y, 40 * edge * 4, 38 * edge * 4, 36 * edge * 4);
    }
    // skull
    const cx = 32, cy = 32;
    for (let dy = -8; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) {
      const d = (dx * dx) / 49 + (dy * dy) / 64;
      if (d <= 1) {
        const s = 0.85 - d * 0.3;
        texPut(px, cx + dx, cy + dy, 205 * s, 198 * s, 180 * s);
      }
    }
    // jaw
    for (let dy = 7; dy <= 11; dy++) for (let dx = -4; dx <= 4; dx++) {
      texPut(px, cx + dx, cy + dy, 170, 162, 148);
      if (dx % 2 === 0) texPut(px, cx + dx, cy + dy, 120, 112, 100);
    }
    // eye sockets
    for (let dy = -3; dy <= 0; dy++) for (let dx = -5; dx <= -2; dx++) {
      texPut(px, cx + dx, cy + dy, 15, 12, 12);
      texPut(px, cx - dx, cy + dy, 15, 12, 12);
    }
    // nose
    texPut(px, cx, cy + 3, 20, 16, 16);
    texPut(px, cx - 1, cy + 4, 20, 16, 16);
    texPut(px, cx + 1, cy + 4, 20, 16, 16);
  });

  // -- wooden door --
  const doorGen = (locked) => (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const plank = Math.floor(x / 11);
      const grain = Math.sin(y * 0.35 + plank * 9 + Math.sin(x * 1.7) * 0.6) * 0.09;
      let s = 0.85 + grain + ((x % 11 === 0) ? -0.4 : 0);
      s += (Math.sin(x * 12.9898 + y * 78.233) % 1) * 0.03;
      texPut(px, x, y, 118 * s, 78 * s, 40 * s);
    }
    // iron bands
    for (const by of [10, 48]) {
      for (let y = by; y < by + 6; y++) for (let x = 2; x < 62; x++) {
        const s = (y === by || y === by + 5) ? 0.4 : 0.75 + ((x % 9 === 4) ? 0.35 : 0);
        texPut(px, x, y, 62 * s, 64 * s, 70 * s);
      }
    }
    // frame edges
    for (let y = 0; y < TEX_SIZE; y++) {
      for (const x of [0, 1, 62, 63]) texPut(px, x, y, 40, 34, 26);
    }
    if (locked) {
      // gold lock plate
      for (let dy = -6; dy <= 6; dy++) for (let dx = -5; dx <= 5; dx++) {
        if (dx * dx + dy * dy > 32) continue;
        const s = 0.9 - (dx * dx + dy * dy) / 60;
        texPut(px, 32 + dx, 32 + dy, 210 * s, 170 * s, 50 * s);
      }
      // keyhole
      for (let dy = -2; dy <= 0; dy++) texPut(px, 32, 32 + dy, 20, 16, 8);
      for (let dy = 1; dy <= 3; dy++) { texPut(px, 32, 32 + dy, 20, 16, 8); texPut(px, 31, 32 + dy, 20, 16, 8); texPut(px, 33, 32 + dy, 20, 16, 8); }
    } else {
      // iron ring handle
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        const x = Math.round(46 + Math.cos(ang) * 4), y = Math.round(34 + Math.sin(ang) * 4);
        texPut(px, x, y, 70, 72, 80);
      }
    }
  };
  buildTexture(T_DOOR, doorGen(false));
  buildTexture(T_DOOR_LOCKED, doorGen(true));

  // -- floor: worn stone tiles --
  buildTexture(T_FLOOR, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const tx = x % 16, ty = y % 16;
      const tid = Math.floor(x / 16) + Math.floor(y / 16) * 4;
      const t = Math.sin(tid * 91.7) * 43758.5453;
      const tint = (t - Math.floor(t) - 0.5) * 0.25;
      let s = 0.8 + tint + (Math.sin(x * 12.9898 + y * 78.233) % 1) * 0.05;
      if (tx === 0 || ty === 0) s *= 0.5;
      texPut(px, x, y, 78 * s, 72 * s, 66 * s);
    }
    // scattered rubble specks
    for (let i = 0; i < 60; i++) {
      const x = rngInt(rng, 0, 63), y = rngInt(rng, 0, 63);
      const s = 0.5 + rng() * 0.7;
      texPut(px, x, y, 70 * s, 66 * s, 60 * s);
    }
  });

  // -- ceiling: rough dark rock --
  buildTexture(T_CEIL, (px) => {
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const n = Math.sin(x * 0.55 + Math.sin(y * 0.35) * 2.2) * Math.cos(y * 0.42 + Math.sin(x * 0.25) * 1.8);
      let s = 0.5 + n * 0.18 + (Math.sin(x * 12.9898 + y * 78.233) % 1) * 0.06;
      texPut(px, x, y, 52 * s, 48 * s, 50 * s);
    }
  });
}
