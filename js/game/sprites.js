// ---- procedural pixel-art sprites (enemies, items, weapon) ----
'use strict';

const SPRITES = {}; // name -> array of {w,h,data:Uint32Array}
const WEAPON_FRAMES = []; // canvases for first-person sword overlay

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

function drawPotion(ctx, p) {
  p.disc(8, 11, 3.6, '#5a0a12');
  p.disc(8, 10.6, 3, '#c0182a');
  p.px(7, 9, '#ff8090');
  p.rect(7, 4, 3, 4, '#7a4a2a'); // neck
  p.rect(6, 3, 5, 2, '#9a6a3a'); // cork
  p.rect(6, 7, 5, 1, '#3a3a44'); // band
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

function drawStairs(ctx, p) {
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

// ---------------- first-person weapon ----------------

function drawWeaponFrame(angleDeg, thrust) {
  const c = makeCanvas(96, 96);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const p = P(ctx);
  ctx.save();
  // pivot near bottom-right where the fist is
  ctx.translate(58, 88 - thrust * 14);
  ctx.rotate(angleDeg * Math.PI / 180);
  // blade
  p.line(0, -16, 0, -54, '#8f97a3', 7);
  p.line(0, -16, 0, -54, '#c9d2dc', 5);
  p.line(0, -18, 0, -52, '#eef2f6', 2);
  // blade tip taper
  p.line(-2, -54, 0, -63, '#c9d2dc', 3);
  p.line(1, -54, 0, -61, '#8f97a3', 2);
  // fuller groove
  p.line(0, -22, 0, -46, '#7a828e', 1);
  // crossguard
  p.rect(-12, -18, 24, 5, '#8a6a14');
  p.rect(-12, -18, 24, 2, '#c9a428');
  p.px(-12, -17, '#ffe070'); p.px(11, -17, '#ffe070');
  // grip
  p.line(0, -12, 0, 0, '#5a3a20', 6);
  p.line(0, -11, 0, -1, '#7a5230', 4);
  // pommel
  p.disc(0, 3, 4, '#8a6a14');
  p.disc(0, 2.6, 2.8, '#c9a428');
  // gauntlet fist wrapping grip
  p.rect(-8, -10, 16, 10, '#4a4e58');
  p.rect(-7, -9, 14, 8, '#6a707c');
  p.rect(-7, -9, 14, 2, '#8a92a0');
  for (let i = 0; i < 4; i++) p.rect(-6 + i * 4, -4, 3, 4, '#565c66');
  // arm/vambrace toward bottom-right corner
  p.line(4, 2, 22, 18, '#4a4e58', 13);
  p.line(6, 4, 22, 16, '#6a707c', 8);
  p.line(8, 4, 20, 13, '#8a92a0', 3);
  ctx.restore();
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

  SPRITES.potion = [makeSpriteFrame(16, 16, drawPotion)];
  SPRITES.gold = [makeSpriteFrame(16, 16, drawGold)];
  SPRITES.key = [makeSpriteFrame(16, 16, drawKey)];
  SPRITES.torch = [
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 0)),
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 1)),
    makeSpriteFrame(16, 24, (c, p) => drawTorch(c, p, 2)),
  ];
  SPRITES.stairs = [makeSpriteFrame(32, 34, drawStairs)];
  SPRITES.crown = [
    makeSpriteFrame(20, 16, (c, p) => drawCrown(c, p, 0)),
    makeSpriteFrame(20, 16, (c, p) => drawCrown(c, p, 1)),
  ];

  // weapon: idle, wind-up, mid-swing, follow-through
  WEAPON_FRAMES.length = 0;
  WEAPON_FRAMES.push(drawWeaponFrame(-8, 0));   // idle, slight tilt
  WEAPON_FRAMES.push(drawWeaponFrame(-38, 0.2)); // wind up right
  WEAPON_FRAMES.push(drawWeaponFrame(18, 0.9));  // slash across
  WEAPON_FRAMES.push(drawWeaponFrame(42, 0.5));  // follow through
}
