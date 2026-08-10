// ---- game/textures: procedural 64x64 wall/floor art, DOS palette flavor ----
// Texture ids come from game/tiles.js (tile id == texture key).
'use strict';

const TEX_SIZE = 64;

const Textures = {}; // id -> {data: Uint32Array, w, h}

function texPut(px, x, y, r, g, b) {
  px[y * TEX_SIZE + x] = rgb(post(r), post(g), post(b));
}

// stamp bitmap-font text straight into a texture (used for shop plaques)
function texText(px, text, x, y, r, g, b) {
  text = String(text).toUpperCase();
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const gl = FONT[text[i]];
    if (gl) {
      for (let row = 0; row < 7; row++) {
        const bits = gl[row];
        if (!bits) continue;
        for (let col = 0; col < 5; col++) {
          if (bits & (0x10 >> col)) texPut(px, cx + col, y + row, r, g, b);
        }
      }
    }
    cx += 6;
  }
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

  // -- shop windows: arched recess, wares on a shelf, hooded keeper, plaque --
  const SHOP_STYLE = {
    potion: { plaque: 'POTIONS', robe: [72, 46, 100], wares: 'bottles' },
    weapon: { plaque: 'WEAPONS', robe: [100, 50, 34], wares: 'blades' },
    armor:  { plaque: 'ARMOR',   robe: [54, 64, 88],  wares: 'plate' },
  };

  // arched recess half-width at row y (-1 above the arch)
  const shopHalf = (y) => {
    if (y < 5) return -1;
    if (y >= 13) return 21;
    const k = (13 - y) / 8;
    return Math.round(Math.sqrt(Math.max(0, 1 - k * k)) * 21);
  };

  const shopGen = (kind) => (px) => {
    const st = SHOP_STYLE[kind];
    const b = genBrickBase(rng);
    for (let y = 0; y < TEX_SIZE; y++) for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const s = clamp(b.shade[i] + b.brickTint[i], 0.2, 1.4);
      texPut(px, x, y, 104 * s, 96 * s, 88 * s);
    }

    // recess interior, lit by an unseen candle up and to the left
    for (let y = 5; y <= 41; y++) {
      const hw = shopHalf(y);
      if (hw < 0) continue;
      for (let x = 32 - hw; x <= 32 + hw; x++) {
        const dx = x - 22, dy = y - 12;
        const g = clamp(1.5 - Math.sqrt(dx * dx + dy * dy) * 0.062, 0.3, 1.5);
        texPut(px, x, y, 34 * g, 27 * g, 22 * g);
      }
      texPut(px, 32 - hw - 1, y, 132, 124, 114); // lit reveal
      texPut(px, 32 + hw + 1, y, 70, 64, 58);    // shadowed reveal
    }

    // shelf across the back of the recess
    for (let x = 12; x <= 51; x++) { texPut(px, x, 20, 92, 62, 32); texPut(px, x, 21, 46, 30, 16); }

    // wares standing on the shelf
    if (st.wares === 'bottles') {
      const cols = [[190, 40, 62], [50, 96, 200], [64, 176, 92], [200, 158, 54]];
      [[13, 0], [18, 1], [42, 2], [47, 3]].forEach(([bx, ci], i) => {
        const c = cols[ci], top = 13 + (i % 2);
        for (let y = top + 2; y <= 19; y++) for (let x = bx; x <= bx + 3; x++) {
          const s = x === bx ? 1.25 : (x === bx + 3 ? 0.6 : 1);
          texPut(px, x, y, c[0] * s, c[1] * s, c[2] * s);
        }
        for (let y = top; y < top + 2; y++) texPut(px, bx + 1, y, 120, 100, 70);
        texPut(px, bx + 2, top, 150, 128, 92);
      });
    } else if (st.wares === 'blades') {
      for (const bx of [15, 46]) {
        for (let y = 10; y <= 19; y++) { texPut(px, bx, y, 176, 184, 196); texPut(px, bx + 1, y, 116, 124, 138); }
        for (let x = bx - 3; x <= bx + 4; x++) texPut(px, x, 9, 158, 118, 44);
        texPut(px, bx, 8, 90, 70, 30); texPut(px, bx + 1, 8, 90, 70, 30);
      }
    } else {
      // helmet on the left, round shield on the right
      for (let dy = -6; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
        if ((dx * dx) / 25 + (dy * dy) / 36 > 1) continue;
        const s = dy < -2 ? 1.15 : 0.8;
        texPut(px, 17 + dx, 14 + dy, 130 * s, 138 * s, 150 * s);
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) texPut(px, 17 + dx, 14 + dy, 20, 18, 22);
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        if (dx * dx + dy * dy > 36) continue;
        const s = 1 - (dx + dy) * 0.03;
        texPut(px, 46 + dx, 13 + dy, 108 * s, 82 * s, 44 * s);
      }
      for (let dy = -6; dy <= 6; dy++) texPut(px, 46, 13 + dy, 168, 172, 184);
      for (let dx = -6; dx <= 6; dx++) texPut(px, 46 + dx, 13, 168, 172, 184);
    }

    // the keeper: robed shoulders, deep hood, two lamplit eyes
    for (let y = 25; y <= 41; y++) {
      const hw = Math.min(shopHalf(y), Math.round(6 + (y - 25) * 0.62));
      for (let x = 32 - hw; x <= 32 + hw; x++) {
        const edge = Math.abs(x - 32) / (hw || 1);
        const s = edge > 0.72 ? 0.5 : (edge < 0.3 ? 1.2 : 0.85);
        texPut(px, x, y, st.robe[0] * s, st.robe[1] * s, st.robe[2] * s);
      }
    }
    for (let dy = -8; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) {
      if ((dx * dx) / 49 + (dy * dy) / 64 > 1) continue;
      const s = 0.62 + (1 - ((dx * dx) / 49 + (dy * dy) / 64)) * 0.42;
      texPut(px, 32 + dx, 22 + dy, st.robe[0] * s, st.robe[1] * s, st.robe[2] * s);
    }
    for (let dy = -3; dy <= 5; dy++) for (let dx = -4; dx <= 4; dx++) {
      if ((dx * dx) / 16 + (dy * dy) / 25 > 1) continue;
      texPut(px, 32 + dx, 22 + dy, 14, 10, 14);
    }
    texPut(px, 30, 21, 250, 214, 120); texPut(px, 34, 21, 250, 214, 120);
    texPut(px, 30, 22, 150, 118, 46);  texPut(px, 34, 22, 150, 118, 46);

    // knuckly hands laid on the counter
    for (const hx of [24, 40]) {
      for (let y = 36; y <= 39; y++) for (let x = hx - 2; x <= hx + 2; x++) texPut(px, x, y, 156, 134, 108);
      for (let x = hx - 2; x <= hx + 2; x += 2) texPut(px, x, 36, 198, 178, 146);
    }

    // counter slab
    for (let y = 40; y <= 45; y++) for (let x = 6; x <= 57; x++) {
      const s = y === 40 ? 1.3 : (y === 45 ? 0.45 : 0.85 + Math.sin(x * 0.7) * 0.07);
      texPut(px, x, y, 98 * s, 64 * s, 34 * s);
    }
    for (let y = 40; y <= 45; y++) { texPut(px, 5, y, 40, 32, 24); texPut(px, 58, y, 40, 32, 24); }

    // brass plaque, letters struck into the metal
    for (let y = 47; y <= 59; y++) for (let x = 5; x <= 58; x++) {
      if (y === 47 || x === 5) texPut(px, x, y, 178, 146, 62);
      else if (y === 59 || x === 58) texPut(px, x, y, 56, 42, 16);
      else texPut(px, x, y, 112, 88, 36);
    }
    for (const [sx, sy] of [[8, 50], [55, 50], [8, 56], [55, 56]]) texPut(px, sx, sy, 44, 34, 14);
    const tx = 32 - Math.floor((st.plaque.length * 6 - 1) / 2);
    texText(px, st.plaque, tx, 51, 190, 160, 80); // highlight
    texText(px, st.plaque, tx, 50, 24, 18, 6);    // engraved face

    // The raycaster mirrors every wall face so brickwork does not flip between
    // sides; lettering has to be pre-flipped to survive that.
    for (let y = 0; y < TEX_SIZE; y++) {
      for (let x = 0; x < TEX_SIZE >> 1; x++) {
        const a = y * TEX_SIZE + x, b = y * TEX_SIZE + (TEX_SIZE - 1 - x);
        const t = px[a]; px[a] = px[b]; px[b] = t;
      }
    }
  };
  buildTexture(T_SHOP_POTION, shopGen('potion'));
  buildTexture(T_SHOP_WEAPON, shopGen('weapon'));
  buildTexture(T_SHOP_ARMOR, shopGen('armor'));

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
