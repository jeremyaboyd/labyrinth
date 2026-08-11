// ---- procedural pixel-art sprites (enemies, items, weapon) ----
'use strict';

const SPRITES = {}; // name -> array of {w,h,data:Uint32Array}
const WEAPON_FRAMES = {}; // fp name -> 4 canvases for the first-person overlay
const WEAPON_CENTRED = { bow: true }; // held on the sight line, not in the corner

// tiny drawing kit on a 2d ctx (1 unit = 1 pixel)
function P(ctx) {
  return {
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); },
    rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    disc(cx, cy, r, c) {
      ctx.fillStyle = c;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) ctx.fillRect(x, y, 1, 1);
    },
    line(x0, y0, x1, y1, c, th) {
      th = th || 1;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
      ctx.fillStyle = c;
      for (let i = 0; i <= steps; i++) {
        const x = lerp(x0, x1, i / steps), y = lerp(y0, y1, i / steps);
        ctx.fillRect(Math.round(x - th / 2), Math.round(y - th / 2), th, th);
      }
    },
  };
}

function makeSpriteFrame(w, h, drawFn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx, P(ctx));
  const f = canvasPixels(c);
  f.canvas = c; // kept for HUD icon drawing
  return f;
}

// white-hot variant for pain flashes
function painVariant(frame) {
  const d = new Uint32Array(frame.data.length);
  for (let i = 0; i < d.length; i++) {
    if (frame.data[i] >>> 24) d[i] = rgb(255, 220, 200);
  }
  return { w: frame.w, h: frame.h, data: d };
}


// ---------------- the mine mouth ----------------
// Pit props: two legs and a cap beam, braced at the corners, with the tunnel
// left open between them. It is what tells you a hole in a cliff is a way in.
const TIMBER = '#7a5426', TIMBER_L = '#9c6d36', TIMBER_D = '#4a3016';

function drawMineFrame(ctx, p) {
  const W = 32, H = 40;
  // cap beam across the top, overhanging both legs
  p.rect(0, 3, W, 7, TIMBER);
  p.rect(0, 3, W, 2, TIMBER_L);
  p.rect(0, 9, W, 1, TIMBER_D);
  // a second, shorter beam sat on the first
  p.rect(4, 0, W - 8, 3, TIMBER_D);

  for (const lx of [3, W - 9]) {
    p.rect(lx, 10, 6, H - 10, TIMBER);
    p.rect(lx, 10, 2, H - 10, TIMBER_L);       // lit edge
    p.rect(lx + 5, 10, 1, H - 10, TIMBER_D);   // shadowed edge
    // grain
    for (let y = 13; y < H - 2; y += 5) p.rect(lx + 2, y, 3, 1, TIMBER_D);
  }

  // corner braces, cut at 45 degrees into the corners
  for (let i = 0; i < 6; i++) {
    p.rect(9 + i, 10 + i, 3, 2, i < 3 ? TIMBER_L : TIMBER);
    p.rect(W - 12 - i, 10 + i, 3, 2, i < 3 ? TIMBER_L : TIMBER);
  }
  // bolts
  for (const bx of [5, W - 7]) { p.px(bx, 12, '#3a2a18'); p.px(bx, 24, '#3a2a18'); }
}

// ---------------- shaft ladders ----------------
// The way up runs from the floor into the hole in the ceiling; the way down
// stands half a tile proud of the black shaft at your feet.
function drawLadder(ctx, p, H) {
  const W = 14;
  for (const lx of [1, W - 4]) {
    p.rect(lx, 0, 3, H, TIMBER);
    p.rect(lx, 0, 1, H, TIMBER_L);      // lit edge
    p.rect(lx + 2, 0, 1, H, TIMBER_D);  // shadowed edge
  }
  for (let y = 2; y < H - 2; y += 7) {
    p.rect(1, y, W - 2, 2, TIMBER_L);
    p.rect(1, y + 2, W - 2, 1, TIMBER_D);
  }
}

// ---------------- enemies ----------------

const BONE = '#d8d0c0', BONE_D = '#968d78', DARK = '#1a140f';

function drawSkeleton(ctx, p, pose) {
  // pose: {legSwing, armSwing, attack}
  const cx = 12;
  const ls = pose.legSwing, as = pose.armSwing;
  // legs
  p.line(cx - 2, 20, cx - 3 - ls, 30, BONE_D, 2);
  p.line(cx + 2, 20, cx + 3 + ls, 30, BONE_D, 2);
  p.line(cx - 2, 20, cx - 3 - ls, 30, BONE, 1);
  p.line(cx + 2, 20, cx + 3 + ls, 30, BONE, 1);
  // pelvis
  p.rect(cx - 3, 18, 7, 3, BONE_D);
  p.rect(cx - 2, 18, 5, 2, BONE);
  // spine
  p.line(cx, 10, cx, 18, BONE, 1);
  // ribs
  p.rect(cx - 4, 11, 9, 1, BONE);
  p.rect(cx - 4, 13, 9, 1, BONE);
  p.rect(cx - 3, 15, 7, 1, BONE);
  p.px(cx - 4, 12, BONE_D); p.px(cx + 4, 12, BONE_D);
  p.px(cx - 4, 14, BONE_D); p.px(cx + 4, 14, BONE_D);
  // arms
  if (pose.attack) {
    // sword raised overhead in right hand
    p.line(cx + 4, 11, cx + 8, 4, BONE, 2);
    p.line(cx - 4, 11, cx - 7, 16 + as, BONE, 2);
    // rusty sword
    p.line(cx + 8, 4, cx + 8, -6, '#8a6a52', 2);
    p.line(cx + 8, 4, cx + 8, -6, '#b0a294', 1);
    p.rect(cx + 6, 3, 5, 1, '#6b5340');
  } else {
    p.line(cx + 4, 11, cx + 6 + as, 17, BONE, 2);
    p.line(cx - 4, 11, cx - 6 - as, 17, BONE, 2);
    // sword held low
    p.line(cx + 6 + as, 17, cx + 9 + as, 24, '#8a6a52', 2);
    p.line(cx + 6 + as, 17, cx + 9 + as, 24, '#b0a294', 1);
  }
  // skull
  p.disc(cx, 6, 4, BONE_D);
  p.disc(cx, 5.6, 3.4, BONE);
  p.rect(cx - 2, 9, 5, 2, BONE); // jaw
  p.px(cx - 1, 10, DARK); p.px(cx + 1, 10, DARK);
  // eyes (ember red)
  p.px(cx - 2, 5, '#200a0a'); p.px(cx + 2, 5, '#200a0a');
  p.px(cx - 2, 5, '#e03020'); p.px(cx + 2, 5, '#e03020');
  p.px(cx - 1, 5, DARK); // nose shadow between eyes
  p.px(cx, 7, DARK);
}

function drawRat(ctx, p, pose) {
  const B = '#6d5138', BD = '#4a3624', BL = '#8a6a4a';
  // tail
  p.line(3, 18, -1 + pose.tail, 13, '#b08a76', 1);
  // body
  p.disc(12, 17, 5, BD);
  p.disc(12.5, 16.5, 4.2, B);
  p.disc(11, 15.5, 2.2, BL);
  // head
  p.disc(19, 15, 3, B);
  p.line(21, 15, 23, 16, B, 2);
  // ears
  p.disc(18, 12, 1.4, '#a3766a');
  p.disc(20.5, 12.4, 1.2, '#a3766a');
  // eye + nose
  p.px(20, 14, '#ff2020');
  p.px(23, 16, DARK);
  // legs
  const l = pose.leg;
  p.line(9, 21, 8 - l, 24, BD, 1);
  p.line(13, 21, 14 + l, 24, BD, 1);
  p.line(17, 19, 17 - l, 23, BD, 1);
  p.line(20, 18, 21 + l, 22, BD, 1);
}

function drawWraith(ctx, p, pose) {
  const R = '#3a3348', RD = '#241f30', RL = '#54497a';
  const sway = pose.sway;
  // tattered robe silhouette
  for (let y = 6; y < 30; y++) {
    const half = 2.5 + (y - 6) * 0.28 + Math.sin(y * 1.1 + sway * 3) * 0.5;
    const xoff = Math.sin(y * 0.45 + sway * 2) * 1.1;
    // jagged hem
    if (y > 24 && Math.sin(y * 7 + (12 + xoff)) > 0.2) continue;
    for (let x = Math.round(12 + xoff - half); x <= Math.round(12 + xoff + half); x++) {
      const edge = Math.abs(x - (12 + xoff)) / half;
      p.px(x, y, edge > 0.62 ? RD : (edge < 0.3 && y > 8 && y < 22 ? RL : R));
    }
  }
  // hood
  p.disc(12, 7, 4.4, RD);
  p.disc(12, 7.5, 3.6, R);
  // void face
  p.disc(12, 8, 2.4, '#0a0812');
  // glowing eyes
  p.px(10.6 + sway * 0.5, 8, '#59f0c8');
  p.px(13.4 + sway * 0.5, 8, '#59f0c8');
  // spectral arms
  p.line(8, 14, 5 + sway, 19, R, 2);
  p.line(16, 14, 19 - sway, 19, R, 2);
  p.px(4.6 + sway, 19.6, RL); p.px(19.4 - sway, 19.6, RL);
}

// ---------------- items & props ----------------

function drawPotion(ctx, p, pal) {
  pal = pal || { dark: '#5a0a12', body: '#c0182a', shine: '#ff8090' };
  p.disc(8, 11, 3.6, pal.dark);
  p.disc(8, 10.6, 3, pal.body);
  p.px(7, 9, pal.shine);
  p.rect(7, 4, 3, 4, '#7a4a2a'); // neck
  p.rect(6, 3, 5, 2, '#9a6a3a'); // cork
  p.rect(6, 7, 5, 1, '#3a3a44'); // band
}

// ---------------- gear icons ----------------

const BLADE_PAL = {
  bronze: { dark: '#6a4a1c', mid: '#b08840', hi: '#e8c878', guard: '#7a5a18', grip: '#5a3a20', pommel: '#c9a428' },
  iron:   { dark: '#5a6070', mid: '#9aa2b0', hi: '#d8e0ea', guard: '#6a6250', grip: '#4a3428', pommel: '#8a8270' },
  steel:  { dark: '#7a828e', mid: '#c9d2dc', hi: '#eef2f6', guard: '#8a6a14', grip: '#5a3a20', pommel: '#c9a428' },
};

const HEAD_PAL = { bronze: '#c08840', iron: '#a8b0bc', steel: '#e0e8f0' };

function drawSwordIcon(ctx, p, pal) {
  p.line(3, 13, 13, 3, pal.dark, 4);
  p.line(3, 13, 13, 3, pal.mid, 2);
  p.line(4, 12, 12, 4, pal.hi, 1);
  p.px(13, 2, pal.hi);
  p.line(1, 9, 6, 14, pal.guard, 2);   // crossguard
  p.line(0, 12, 3, 15, pal.grip, 3);   // grip
  p.px(0, 15, pal.pommel);
}

function drawBowIcon(ctx, p) {
  const W1 = '#7a4e22', W2 = '#a87038';
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, a = (-0.85 + t * 1.7);
    const x = 11 - Math.cos(a) * 6.5, y = 8 + Math.sin(a) * 7.5;
    p.px(x, y, W1); p.px(x - 1, y, W2);
  }
  p.line(9.5, 1, 9.5, 15, '#d8d0bc', 1); // string
  p.line(2, 8, 13, 8, '#8a7a5a', 1);     // nocked arrow
  p.line(11, 8, 14, 8, HEAD_PAL.iron, 1);
  p.px(3, 7, '#c8c0b0'); p.px(3, 9, '#c8c0b0');
}

function drawStaffIcon(ctx, p) {
  p.line(2, 15, 10, 5, '#4a3420', 3);
  p.line(2.5, 14.5, 10, 5.5, '#6d5030', 1);
  p.disc(11, 4, 3.4, '#2a4a80');
  p.disc(11, 4, 2.2, '#50a0f0');
  p.disc(11, 3.6, 1, '#d8f0ff');
  p.px(14, 1, '#a0d8ff'); p.px(8, 1, '#a0d8ff'); p.px(15, 6, '#a0d8ff');
}

function drawArrowIcon(ctx, p, head) {
  p.line(2, 14, 12, 4, '#8a6a44', 2);
  p.line(2.5, 13.5, 11, 5, '#b08a5c', 1);
  p.line(11, 5, 14, 2, head, 2);       // head
  p.px(14, 1, '#ffffff');
  p.line(1, 15, 5, 11, '#c8c0b0', 1);  // fletching
  p.px(2, 13, '#e8e0d0'); p.px(4, 15, '#e8e0d0');
}

function drawArmorIcon(ctx, p, pal) {
  // breastplate: shoulders wide at top, tapering to the waist
  for (let y = 3; y <= 14; y++) {
    const half = y < 5 ? 6 : Math.max(2.5, 6 - (y - 5) * 0.35);
    for (let x = Math.round(8 - half); x <= Math.round(8 + half); x++) {
      const edge = Math.abs(x - 8) / half;
      p.px(x, y, edge > 0.78 ? pal[2] : (edge < 0.25 ? pal[0] : pal[1]));
    }
  }
  p.rect(5, 2, 7, 2, pal[2]);  // collar
  p.px(8, 3, '#141014');
  p.rect(3, 4, 3, 2, pal[0]);  // pauldrons
  p.rect(11, 4, 3, 2, pal[0]);
  p.line(8, 6, 8, 14, pal[2], 1); // centre seam
}

function drawTonicIcon(ctx, p, body, shine) {
  p.rect(5, 6, 7, 8, '#2a2418');
  p.rect(6, 7, 5, 6, body);
  p.px(6, 8, shine);
  p.rect(7, 2, 3, 4, '#3a3a44'); // long neck
  p.rect(6, 1, 5, 2, '#c8a038'); // gold cap
  p.rect(4, 13, 9, 2, '#6a5228'); // base
}

// ---------------- projectiles ----------------

function drawArrowShot(ctx, p, head) {
  p.line(1, 4, 10, 4, '#8a6a44', 2);
  p.line(1, 4, 9, 4, '#b08a5c', 1);
  p.line(10, 4, 14, 4, head, 2);
  p.px(15, 4, '#ffffff');
  p.line(0, 1, 3, 4, '#d8d0c0', 1);
  p.line(0, 7, 3, 4, '#d8d0c0', 1);
}

function drawMagicBolt(ctx, p, f) {
  const r = f ? 5 : 4.4;
  p.disc(8, 8, r, '#1a3a78');
  p.disc(8, 8, r - 1.4, '#3a78e0');
  p.disc(8, 8, r - 2.8, '#a8d8ff');
  p.px(8, 8, '#ffffff');
  const spark = f ? [[2, 4], [13, 5], [6, 14]] : [[13, 3], [3, 11], [11, 13]];
  for (const [sx, sy] of spark) p.px(sx, sy, '#a8d8ff');
}

function drawGold(ctx, p) {
  const G = '#d8a418', GD = '#8a6408', GL = '#ffe070';
  p.disc(6, 12, 3, GD); p.disc(6, 11.5, 2.4, G);
  p.disc(11, 13, 3, GD); p.disc(11, 12.5, 2.4, G);
  p.disc(9, 10, 3, GD); p.disc(9, 9.5, 2.4, G);
  p.px(8, 9, GL); p.px(5, 11, GL); p.px(11, 12, GL);
}

function drawKey(ctx, p) {
  const G = '#e8c030', GD = '#94741c';
  // bow (ring)
  p.disc(8, 5, 3, GD);
  p.disc(8, 5, 1.4, '#00000000');
  ctx.clearRect(7, 4, 3, 3);
  // shaft
  p.rect(7, 8, 2, 7, G);
  // teeth
  p.rect(9, 12, 3, 1, G);
  p.rect(9, 14, 2, 1, G);
  p.px(7, 8, '#fff0a0');
}

// somebody's lost keepsake, wrapped in cloth with a glint at the knot
function drawTrinket(ctx, p) {
  p.rect(4, 8, 8, 6, '#7a5c38');
  p.rect(5, 9, 6, 4, '#96754a');
  p.line(4, 10, 11, 13, '#5c4426', 1);
  p.line(4, 13, 11, 9, '#5c4426', 1);
  p.disc(8, 7, 2, '#c9d2dc');
  p.px(7, 6, '#ffffff');
  p.px(9, 8, '#8a94a0');
}

function drawTorch(ctx, p, flame) {
  // bracket + handle
  p.rect(7, 14, 3, 8, '#5a3a1c');
  p.px(7, 14, '#7a5a30');
  p.rect(6, 13, 5, 2, '#4a4a52');
  // flame layers, flicker by frame
  const fx = [0, -1, 1][flame];
  const fh = [0, 1, -1][flame];
  p.disc(8 + fx * 0.5, 9 + fh * 0.5, 3.4, '#c03808');
  p.disc(8 + fx * 0.4, 8 + fh, 2.6, '#f07010');
  p.disc(8 + fx * 0.3, 7.6 + fh, 1.6, '#ffc020');
  p.px(8 - fx, 6 + fh, '#fff090');
  p.px(8 + fx, 4 + fh + flame, '#f07010'); // spark
}

// drawStairsDown, not drawStairs: menus.js declares a drawStairs of its own for
// the stairwell screen, and in classic scripts the last file loaded wins the
// global. generateSprites() runs at boot, long after menus.js, so the short
// name here silently resolved to that screen instead of this artist.
function drawStairsDown(ctx, p) {
  // stone arch frame
  p.rect(2, 2, 28, 30, '#6a6258');
  p.rect(4, 4, 24, 28, '#141210');
  // descending steps into darkness
  const steps = ['#5a5248', '#48423a', '#38332c', '#28241f', '#181512'];
  let y = 8;
  for (let i = 0; i < steps.length; i++) {
    const inset = 4 + i * 2;
    p.rect(inset, y, 32 - inset * 2, 3, steps[i]);
    p.rect(inset, y + 3, 32 - inset * 2, 1, '#0c0a08');
    y += 4;
  }
  // arch highlight
  p.rect(2, 2, 28, 2, '#7c7468');
  p.rect(2, 2, 2, 30, '#7c7468');
  p.rect(28, 2, 2, 30, '#524c44');
  // faint glow at the threshold
  p.rect(6, 28, 20, 2, '#243428');
}

function drawStairsUp(ctx, p) {
  // same arch, but the steps climb away from you toward a lit landing
  p.rect(2, 2, 28, 30, '#6a6258');
  p.rect(4, 4, 24, 28, '#141210');
  const steps = ['#3a352d', '#4a443b', '#5c5449', '#6e6558', '#807668'];
  let y = 24;
  for (let i = 0; i < steps.length; i++) {
    const inset = 4 + i * 2;
    p.rect(inset, y, 32 - inset * 2, 3, steps[i]);
    p.rect(inset, y - 1, 32 - inset * 2, 1, '#0c0a08');
    y -= 4;
  }
  // arch highlight
  p.rect(2, 2, 28, 2, '#7c7468');
  p.rect(2, 2, 2, 30, '#7c7468');
  p.rect(28, 2, 2, 30, '#524c44');
  // daylight spilling down the flight
  p.rect(12, 5, 8, 3, '#c0b088');
  p.rect(13, 8, 6, 1, '#8e846c');
}

function drawCrown(ctx, p, f) {
  const G = '#f0c030', GD = '#9a7818', GL = '#fff0a0';
  // band
  p.rect(3, 10, 14, 4, GD);
  p.rect(4, 10, 12, 3, G);
  // points
  p.line(4, 10, 4, 5, G, 2);
  p.line(10, 10, 10, 3, G, 2);
  p.line(16, 10, 16, 5, G, 2);
  p.px(4, 4, GL); p.px(10, 2, GL); p.px(16, 4, GL);
  // gems
  p.px(7, 11, '#e02040'); p.px(13, 11, '#2050e0'); p.px(10, 11, '#20c050');
  // sparkle (animated)
  if (f === 1) { p.px(2, 4, GL); p.px(18, 8, GL); }
  else { p.px(18, 3, GL); p.px(2, 9, GL); }
}

// ---------------- surface world ----------------

function drawTree(ctx, p, variant) {
  const cx = 16;
  p.rect(cx - 3, 30, 6, 26, '#4a3320');            // trunk
  p.rect(cx - 3, 30, 2, 26, '#67482c');
  p.line(cx - 3, 53, cx - 7, 56, '#4a3320', 2);    // roots
  p.line(cx + 3, 53, cx + 7, 56, '#4a3320', 2);
  const blobs = variant
    ? [[16, 14, 11], [8, 22, 8], [24, 22, 8], [16, 26, 9]]
    : [[16, 16, 12], [7, 24, 8], [25, 23, 9], [16, 29, 8]];
  for (const [bx, by, br] of blobs) p.disc(bx, by, br, '#1d4a1c');
  for (const [bx, by, br] of blobs) p.disc(bx - 1, by - 1.5, br * 0.78, '#2e6c26');
  for (const [bx, by, br] of blobs) p.disc(bx - 2, by - 3, br * 0.42, '#418c32');
}

// flame < 0 draws the lamp cold
function drawLamp(ctx, p, flame) {
  p.rect(7, 16, 3, 31, '#3a3a42');   // post
  p.rect(7, 16, 1, 31, '#565660');
  p.rect(4, 45, 9, 3, '#2a2a30');    // footing
  p.rect(4, 6, 9, 11, '#2a2a30');    // lantern housing
  p.rect(5, 7, 7, 9, '#12121a');
  p.rect(3, 4, 11, 2, '#3a3a42');    // cap
  p.rect(7, 2, 3, 2, '#3a3a42');
  if (flame >= 0) {
    const fx = [0, -1, 1][flame];
    p.disc(8 + fx * 0.4, 12.5, 3, '#c03808');
    p.disc(8 + fx * 0.3, 11.5, 2.1, '#f07010');
    p.disc(8, 10.5, 1.1, '#ffd040');
    p.px(8 + fx, 9, '#fff0a0');
  }
}

const VILLAGER_PALS = [
  { tunic: '#8a4a3a', tunicL: '#a8604a', tunicD: '#5c3026', legs: '#4a4038', skin: '#c89a72', hair: '#4a3020' },
  { tunic: '#3f5c7a', tunicL: '#557a9c', tunicD: '#2a3c50', legs: '#4a4038', skin: '#a87c58', hair: '#2c2018' },
  { tunic: '#6a6a3a', tunicL: '#8a8a4e', tunicD: '#454526', legs: '#3f3830', skin: '#d8ab84', hair: '#7a6040' },
];

function drawVillager(ctx, p, pose, pal) {
  const cx = 12;
  const l = pose.leg, a = pose.arm;
  p.line(cx - 2, 21, cx - 2 - l, 29, pal.legs, 3);   // legs
  p.line(cx + 2, 21, cx + 2 + l, 29, pal.legs, 3);
  p.rect(cx - 4 - l, 29, 4, 2, '#3a2a1c');           // boots
  p.rect(cx + 1 + l, 29, 4, 2, '#3a2a1c');
  for (let y = 11; y <= 22; y++) {                    // tunic
    const half = 4 + (y - 11) * 0.26;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = Math.abs(x - cx) / half;
      p.px(x, y, edge > 0.74 ? pal.tunicD : (edge < 0.3 ? pal.tunicL : pal.tunic));
    }
  }
  p.rect(cx - 4, 19, 9, 1, '#4a3520');                // belt
  p.line(cx - 4, 12, cx - 5 - a, 19, pal.tunicD, 2);  // arms
  p.line(cx + 4, 12, cx + 5 + a, 19, pal.tunicD, 2);
  p.px(cx - 5 - a, 20, pal.skin);
  p.px(cx + 5 + a, 20, pal.skin);
  p.disc(cx, 7, 3.6, pal.skin);                       // head
  p.disc(cx, 4.8, 3.4, pal.hair);                     // hair
  p.rect(cx - 4, 4, 9, 2, pal.hair);
  p.px(cx - 2, 8, '#2a1a12');                         // eyes
  p.px(cx + 2, 8, '#2a1a12');
  p.px(cx, 10, '#a87858');                            // mouth
}

const KING_PAL = { tunic: '#5a2a72', tunicL: '#7c3f98', tunicD: '#3a1a4c', legs: '#3a3038', skin: '#d8b088', hair: '#c8c0b0' };

function drawKing(ctx, p, pose) {
  drawVillager(ctx, p, pose, KING_PAL);
  const cx = 12;
  p.rect(cx - 4, 17, 9, 3, '#c8a038');   // gold-trimmed hem
  p.rect(cx - 5, 12, 2, 8, '#c8a038');   // mantle edges
  p.rect(cx + 4, 12, 2, 8, '#c8a038');
  p.rect(cx - 5, 1, 11, 3, '#d8a828');   // crown band
  p.rect(cx - 5, 0, 2, 2, '#f0c848');    // points
  p.rect(cx - 1, 0, 2, 2, '#f0c848');
  p.rect(cx + 3, 0, 2, 2, '#f0c848');
  p.px(cx - 3, 2, '#e02040');            // gems
  p.px(cx + 1, 2, '#2050e0');
  p.px(cx + 4, 2, '#20c050');
  p.rect(cx - 3, 11, 7, 1, '#e8d8a8');   // beard
  p.rect(cx - 2, 12, 5, 1, '#e8d8a8');
}

// ---------------- first-person weapon ----------------

// gauntleted fist + forearm running off the bottom corner. dir -1 sends the
// arm out to the left instead, for the hand that holds the bow
function drawGauntlet(p, gx, gy, dir) {
  dir = dir || 1;
  p.rect(gx - 8, gy - 10, 16, 10, '#4a4e58');
  p.rect(gx - 7, gy - 9, 14, 8, '#6a707c');
  p.rect(gx - 7, gy - 9, 14, 2, '#8a92a0');
  for (let i = 0; i < 4; i++) p.rect(gx - 6 + i * 4, gy - 4, 3, 4, '#565c66');
  p.line(gx + 4 * dir, gy + 2, gx + 22 * dir, gy + 18, '#4a4e58', 13);
  p.line(gx + 6 * dir, gy + 4, gx + 22 * dir, gy + 16, '#6a707c', 8);
  p.line(gx + 8 * dir, gy + 4, gx + 20 * dir, gy + 13, '#8a92a0', 3);
}

function newWeaponCanvas() {
  const c = makeCanvas(96, 96);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx, p: P(ctx) };
}

function drawSwordFrame(angleDeg, thrust, pal) {
  const { c, ctx, p } = newWeaponCanvas();
  ctx.save();
  // pivot near bottom-right where the fist is
  ctx.translate(58, 88 - thrust * 14);
  ctx.rotate(angleDeg * Math.PI / 180);
  // blade
  p.line(0, -16, 0, -54, pal.dark, 7);
  p.line(0, -16, 0, -54, pal.mid, 5);
  p.line(0, -18, 0, -52, pal.hi, 2);
  // blade tip taper
  p.line(-2, -54, 0, -63, pal.mid, 3);
  p.line(1, -54, 0, -61, pal.dark, 2);
  // fuller groove
  p.line(0, -22, 0, -46, pal.dark, 1);
  // crossguard
  p.rect(-12, -18, 24, 5, pal.guard);
  p.rect(-12, -18, 24, 2, pal.pommel);
  p.px(-12, -17, '#ffe070'); p.px(11, -17, '#ffe070');
  // grip
  p.line(0, -12, 0, 0, pal.grip, 6);
  p.line(0, -11, 0, -1, '#7a5230', 4);
  // pommel
  p.disc(0, 3, 4, pal.guard);
  p.disc(0, 2.6, 2.8, pal.pommel);
  drawGauntlet(p, 0, 0);
  ctx.restore();
  return c;
}

// Seen from behind the archer rather than side-on: the bow stands across the
// view, the string comes back toward the eye, and the arrow runs out through
// the crosshair, which lands on (AIM_X, AIM_Y) once the frame is placed.
// pull 0..1 draws the string back; loosed hides the arrow and shakes the string.
const BOW_AIM_X = 48, BOW_AIM_Y = 54;

function drawBowFrame(pull, loosed) {
  const { c, ctx, p } = newWeaponCanvas();
  // Canted 27 degrees the way an archer actually holds it: top limb out to the
  // upper right, lower limb down toward the left hip.
  const TILT = 27 * Math.PI / 180;
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const GX = 44, GY = 56; // the grip, just under the sight line
  // The top limb shows its full length; the bottom one drops away toward the
  // hip, so perspective forshortens it. BELLY is how far the stave bows forward.
  const TOPL = 50, BOTL = 36, BELLY = 12;
  // local stave coords (x across the stave, y along it) -> canvas
  const rx = (x, y) => GX + x * ct - y * st;
  const ry = (x, y) => GY + x * st + y * ct;

  // limbs: the belly bows toward the target, tips bend back to meet the string
  for (let i = 0; i <= 240; i++) {
    const t = i / 240; // 0 top tip .. 1 bottom tip
    const lx = BELLY * (1 - Math.sin(Math.PI * t));
    const ly = -TOPL + t * (TOPL + BOTL);
    const bx = rx(lx, ly), by = ry(lx, ly);
    const cols = (t < 0.1 || t > 0.9)
      ? [[1, '#3c2810'], [0, '#5c3c18'], [-1, '#8a5c28']]
      : [[2, '#3c2810'], [1, '#5c3c18'], [0, '#8a5c28'], [-1, '#a87038'], [-2, '#6b4a20']];
    // thickness laid across the stave rather than across the screen
    for (const [k, col] of cols) p.px(bx + k * ct, by + k * st, col);
  }
  // horn nocks at the tips
  const tipTX = rx(BELLY, -TOPL), tipTY = ry(BELLY, -TOPL);
  const tipBX = rx(BELLY, BOTL), tipBY = ry(BELLY, BOTL);
  p.disc(tipTX, tipTY, 2.2, '#d8d0bc');
  p.disc(tipBX, tipBY, 2.2, '#d8d0bc');
  // leather-wrapped riser, canted with the stave
  p.line(rx(0, -13), ry(0, -13), rx(0, 13), ry(0, 13), '#4a3218', 6);
  p.line(rx(0, -12), ry(0, -12), rx(0, 12), ry(0, 12), '#6b4a20', 4);

  // the nock sits back by the cheek; drawing pulls it further back and down
  const nx = BOW_AIM_X + 8 + pull * 14;
  const ny = BOW_AIM_Y + 12 + pull * 18;
  if (loosed) {
    // the string snaps straight and blurs into two
    const msx = (tipTX + tipBX) / 2, msy = (tipTY + tipBY) / 2;
    p.line(tipTX, tipTY, msx - 2, msy, '#e8e0cc', 1);
    p.line(msx - 2, msy, tipBX, tipBY, '#e8e0cc', 1);
    p.line(tipTX, tipTY, msx + 2, msy, '#8a8478', 1);
    p.line(msx + 2, msy, tipBX, tipBY, '#8a8478', 1);
  } else {
    p.line(tipTX, tipTY, nx, ny, '#e8e0cc', 1);
    p.line(nx, ny, tipBX, tipBY, '#e8e0cc', 1);
    // The nocked arrow runs away from the eye and out through the crosshair, so
    // it thins as it goes: a fat shaft at the fletching, a point at the far end.
    const mx = (nx + BOW_AIM_X) / 2, my = (ny + BOW_AIM_Y) / 2;
    p.line(nx, ny, mx, my, '#7a5c38', 4);
    p.line(nx - 1, ny - 1, mx, my - 1, '#b08a5c', 2);
    p.line(mx, my, BOW_AIM_X + 2, BOW_AIM_Y + 2, '#8a6a44', 2);
    // steel head, sitting right on the crosshair
    p.line(BOW_AIM_X + 3, BOW_AIM_Y + 3, BOW_AIM_X, BOW_AIM_Y, '#9aa4b0', 3);
    p.px(BOW_AIM_X, BOW_AIM_Y, '#eef2f6');
    // fletching, splayed either side of the shaft at the near end
    p.line(nx + 6, ny + 2, nx - 2, ny - 5, '#d8d0c0', 1);
    p.line(nx + 6, ny + 5, nx - 1, ny - 1, '#a89c88', 1);
    p.line(nx + 3, ny + 7, nx - 3, ny + 1, '#d8d0c0', 1);
  }
  // bow arm braced from the lower left, fist closed on the riser below the
  // arrow's line of flight so the crosshair stays clear
  drawGauntlet(p, GX - 2, GY + 14, -1);
  // string hand back at the nock, forearm running off the bottom right
  drawGauntlet(p, nx + 7, ny + 12, 1);
  return c;
}

// glow 0..1 swells the orb; raise lifts the whole staff toward the eye
function drawStaffFrame(glow, raise) {
  const { c, ctx, p } = newWeaponCanvas();
  const ox = 36 - raise * 2, oy = 32 - raise;
  // haft from the bottom-right corner up to the head
  p.line(ox + 4, oy + 8, 88, 96 - raise, '#33240f', 9);
  p.line(ox + 4, oy + 8, 86, 96 - raise, '#4f3a1c', 6);
  p.line(ox + 5, oy + 9, 82, 94 - raise, '#6d5030', 2);
  // iron claw cradling the stone
  for (const a of [-2.4, -0.9, 0.6, 2.1]) {
    p.line(ox + Math.cos(a) * 3, oy + Math.sin(a) * 3, ox + Math.cos(a) * 10, oy + Math.sin(a) * 10, '#5a5e68', 3);
  }
  // the stone
  const r = 8 + glow * 5;
  p.disc(ox, oy, r + 2, glow > 0.7 ? '#4a7ad0' : '#1a2c50');
  p.disc(ox, oy, r, '#2a5aa8');
  p.disc(ox, oy, r * 0.66, '#5aa0f0');
  p.disc(ox, oy, r * 0.32, glow > 0.7 ? '#ffffff' : '#c8e8ff');
  if (glow > 0.7) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7]]) {
      p.line(ox + dx * r, oy + dy * r, ox + dx * (r + 11), oy + dy * (r + 11), '#a8d8ff', 1);
    }
  }
  drawGauntlet(p, 66, 74 - raise);
  return c;
}

// ---------------- build all ----------------

function generateSprites() {
  const E = 24, EH = 32;
  // skeleton: walk0, walk1, attack (+pain appended)
  SPRITES.skeleton = [
    makeSpriteFrame(E, EH, (c, p) => drawSkeleton(c, p, { legSwing: 1, armSwing: 1, attack: false })),
    makeSpriteFrame(E, EH, (c, p) => drawSkeleton(c, p, { legSwing: -1, armSwing: -1, attack: false })),
    makeSpriteFrame(E, EH, (c, p) => drawSkeleton(c, p, { legSwing: 0, armSwing: 0, attack: true })),
  ];
  SPRITES.rat = [
    makeSpriteFrame(E, 26, (c, p) => drawRat(c, p, { leg: 1, tail: 0 })),
    makeSpriteFrame(E, 26, (c, p) => drawRat(c, p, { leg: -1, tail: 2 })),
    makeSpriteFrame(E, 26, (c, p) => drawRat(c, p, { leg: 0, tail: 1 })),
  ];
  SPRITES.wraith = [
    makeSpriteFrame(E, EH, (c, p) => drawWraith(c, p, { sway: 0.6 })),
    makeSpriteFrame(E, EH, (c, p) => drawWraith(c, p, { sway: -0.6 })),
    makeSpriteFrame(E, EH, (c, p) => drawWraith(c, p, { sway: 0 })),
  ];
  for (const k of ['skeleton', 'rat', 'wraith']) {
    SPRITES[k].push(painVariant(SPRITES[k][0]));
  }

  SPRITES.gold = [makeSpriteFrame(16, 16, drawGold)];
  SPRITES.key = [makeSpriteFrame(16, 16, drawKey)];
  SPRITES.trinket = [makeSpriteFrame(16, 16, drawTrinket)];
  SPRITES.torch = [
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 0)),
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 1)),
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 2)),
  ];
  SPRITES.stairs = [makeSpriteFrame(32, 34, drawStairsDown)];
  SPRITES.stairsUp = [makeSpriteFrame(32, 34, drawStairsUp)];
  SPRITES.mineFrame = [makeSpriteFrame(32, 40, drawMineFrame)];
  SPRITES.ladderFull = [makeSpriteFrame(14, 64, (c, p) => drawLadder(c, p, 64))];
  SPRITES.ladderHalf = [makeSpriteFrame(14, 32, (c, p) => drawLadder(c, p, 32))];
  SPRITES.crown = [
    makeSpriteFrame(20, 16, (c, p) => drawCrown(c, p, 0)),
    makeSpriteFrame(20, 16, (c, p) => drawCrown(c, p, 1)),
  ];

  // ---- surface world props ----
  SPRITES.tree = [
    makeSpriteFrame(32, 56, (c, p) => drawTree(c, p, 0)),
    makeSpriteFrame(32, 56, (c, p) => drawTree(c, p, 1)),
  ];
  SPRITES.lampOff = [makeSpriteFrame(16, 48, (c, p) => drawLamp(c, p, -1))];
  SPRITES.lampOn = [
    makeSpriteFrame(16, 48, (c, p) => drawLamp(c, p, 0)),
    makeSpriteFrame(16, 48, (c, p) => drawLamp(c, p, 1)),
    makeSpriteFrame(16, 48, (c, p) => drawLamp(c, p, 2)),
  ];
  SPRITES.king = [
    makeSpriteFrame(24, 32, (c, p) => drawKing(c, p, { leg: 0, arm: 0 })),
    makeSpriteFrame(24, 32, (c, p) => drawKing(c, p, { leg: 0, arm: 1 })),
    makeSpriteFrame(24, 32, (c, p) => drawKing(c, p, { leg: 0, arm: 0 })),
  ];
  VILLAGER_PALS.forEach((pal, i) => {
    SPRITES['villager' + i] = [
      makeSpriteFrame(24, 32, (c, p) => drawVillager(c, p, { leg: 1, arm: 1 }, pal)),
      makeSpriteFrame(24, 32, (c, p) => drawVillager(c, p, { leg: -1, arm: -1 }, pal)),
      makeSpriteFrame(24, 32, (c, p) => drawVillager(c, p, { leg: 0, arm: 0 }, pal)),
    ];
  });

  // ---- gear icons (also used as world billboards for dropped loot) ----
  for (const tier of ['bronze', 'iron', 'steel']) {
    const T = tier[0].toUpperCase() + tier.slice(1);
    SPRITES['iconSword' + T] = [makeSpriteFrame(16, 16, (c, p) => drawSwordIcon(c, p, BLADE_PAL[tier]))];
    SPRITES['iconArrow' + T] = [makeSpriteFrame(16, 16, (c, p) => drawArrowIcon(c, p, HEAD_PAL[tier]))];
  }
  SPRITES.iconBow = [makeSpriteFrame(16, 16, drawBowIcon)];
  SPRITES.iconStaff = [makeSpriteFrame(16, 16, drawStaffIcon)];
  const ARMOR_PAL = {
    Leather: ['#a4713c', '#7d5228', '#4c3016'],
    Iron: ['#9aa2b0', '#6e7684', '#454c58'],
    Steel: ['#dde4ec', '#a4aebc', '#6a7482'],
  };
  for (const k in ARMOR_PAL) {
    SPRITES['iconArmor' + k] = [makeSpriteFrame(16, 16, (c, p) => drawArmorIcon(c, p, ARMOR_PAL[k]))];
  }
  SPRITES.iconPotionRed = [makeSpriteFrame(16, 16, (c, p) => drawPotion(c, p))];
  SPRITES.iconPotionBlue = [makeSpriteFrame(16, 16, (c, p) => drawPotion(c, p, { dark: '#0e2058', body: '#2050c8', shine: '#90c0ff' }))];
  SPRITES.iconTonicHp = [makeSpriteFrame(16, 16, (c, p) => drawTonicIcon(c, p, '#c0182a', '#ff8090'))];
  SPRITES.iconTonicMp = [makeSpriteFrame(16, 16, (c, p) => drawTonicIcon(c, p, '#2050c8', '#90c0ff'))];

  // ---- projectiles ----
  for (const tier of ['bronze', 'iron', 'steel']) {
    SPRITES['shot_arrow' + tier[0].toUpperCase() + tier.slice(1)] =
      [makeSpriteFrame(16, 9, (c, p) => drawArrowShot(c, p, HEAD_PAL[tier]))];
  }
  SPRITES.shot_bolt = [
    makeSpriteFrame(16, 16, (c, p) => drawMagicBolt(c, p, 0)),
    makeSpriteFrame(16, 16, (c, p) => drawMagicBolt(c, p, 1)),
  ];

  // ---- first-person overlays: idle, wind-up, strike, follow-through ----
  for (const tier of ['bronze', 'iron', 'steel']) {
    WEAPON_FRAMES['sword' + tier[0].toUpperCase() + tier.slice(1)] = [
      drawSwordFrame(-8, 0, BLADE_PAL[tier]),
      drawSwordFrame(-38, 0.2, BLADE_PAL[tier]),
      drawSwordFrame(18, 0.9, BLADE_PAL[tier]),
      drawSwordFrame(42, 0.5, BLADE_PAL[tier]),
    ];
  }
  WEAPON_FRAMES.bow = [
    drawBowFrame(0.1, false), drawBowFrame(0.62, false),
    drawBowFrame(0, true), drawBowFrame(0.06, false),
  ];
  WEAPON_FRAMES.staff = [
    drawStaffFrame(0.15, 0), drawStaffFrame(0.6, 6),
    drawStaffFrame(1, 10), drawStaffFrame(0.3, 3),
  ];
}
