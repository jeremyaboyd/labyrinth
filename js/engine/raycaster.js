// ---- engine/raycaster: pure software renderer ----
// Knows nothing about game entities or tile meanings. The caller supplies:
//   view       from createView(W, H)
//   lvl        { w, h, slabs, doors, tiles }
//                slabs[idx] => array of solid spans in that cell, sorted by z0
//                              and never overlapping:
//                                { z0, z1, side, top, bot, door?, glow? }
//                              side => texture on the vertical faces (0: none)
//                              top  => texture on the upper surface  (0: none)
//                              bot  => texture on the underside      (0: none)
//   cam        { x, y, z, a, bob }   z is eye height, default 0.5
//   billboards [{ x, y, img: {w,h,data}, hFrac, zOff, glow }]
//   opts       { textures, texSize (pow2), borderTex,
//                fovPlane?, flicker?, ambient?, fogK?, sky? }
//                sky => panorama {w (pow2), h, data} drawn above the horizon
//
// The world is a stack of slabs per cell rather than one wall per cell, so a
// column can show several things at once: the top of a cliff, the wall below
// it, the ground beyond, the underside of an arch overhead. Columns are drawn
// front to back into a list of unpainted screen spans, which is what keeps the
// cost near one write per pixel however deep the stack goes.
'use strict';

const TAU = Math.PI * 2;

// A column can be cut into at most this many unpainted pieces. Each overhang
// the ray passes under splits one span in two; eight is far past anything the
// world builds, and running out only means distant geometry stops drawing.
const MAX_SPANS = 8;

function createView(W, H) {
  const frameImg = new ImageData(W, H);
  return {
    W, H, frameImg,
    buf: new Uint32Array(frameImg.data.buffer),
    // per pixel now, not per column: with slabs the depth down a column varies,
    // so a sprite has to test the row it actually covers
    depth: new Float32Array(W * H),
    skyU: new Int32Array(W), // per-column sky sample, reused each frame
    spanA: new Int32Array(MAX_SPANS),
    spanB: new Int32Array(MAX_SPANS),
    spanN: 0,
  };
}

// fogK sets how fast light falls off: dungeon murk is high, open air is low
function fogLight(d, flicker, ambient, fogK) {
  let l = 1.45 / (1 + d * d * fogK);
  l = l > 1 ? 1 : l;
  l *= flicker * ambient;
  // quantize for chunky DOS banding
  return Math.floor(l * 13) / 13;
}

function shadePix(c, l) {
  const r = ((c & 255) * l) | 0;
  const g = (((c >> 8) & 255) * l * 0.97) | 0;
  const b = (((c >> 16) & 255) * l * 0.9) | 0;
  return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function renderView(view, lvl, cam, billboards, opts) {
  const W = view.W, VIEW_H = view.H;
  const buf = view.buf, depth = view.depth;
  const textures = opts.textures;
  const TS = opts.texSize, TMASK = TS - 1;
  const flicker = opts.flicker != null ? opts.flicker : 1;
  const ambient = opts.ambient != null ? opts.ambient : 1;
  const fogK = opts.fogK != null ? opts.fogK : 0.10;
  const fov = opts.fovPlane != null ? opts.fovPlane : 0.66;
  const sky = opts.sky || null;

  const camX = cam.x, camY = cam.y;
  const camZ = cam.z != null ? cam.z : 0.5;
  const horizon = (VIEW_H >> 1) + Math.round(cam.bob || 0);
  const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
  const planeX = -dirY * fov, planeY = dirX * fov;

  const spanA = view.spanA, spanB = view.spanB;

  // --- background: sky above the horizon, dark below ---
  // Geometry paints over this; whatever it never reaches stays as drawn, which
  // is what gives distant ground its fade to black.
  if (sky) {
    const skyU = view.skyU, sw = sky.w, sh = sky.h, sdata = sky.data;
    for (let x = 0; x < W; x++) {
      const cameraX = 2 * x / W - 1;
      const a = Math.atan2(dirY + planeY * cameraX, dirX + planeX * cameraX);
      let u = ((a / TAU) * sw) | 0;
      u %= sw; if (u < 0) u += sw;
      skyU[x] = u;
    }
    const top = horizon > 0 ? horizon : 1;
    for (let y = 0; y < horizon && y < VIEW_H; y++) {
      let v = ((y / top) * sh) | 0;
      if (v < 0) v = 0; if (v >= sh) v = sh - 1;
      const rowOff = y * W, texOff = v * sw;
      for (let x = 0; x < W; x++) buf[rowOff + x] = sdata[texOff + skyU[x]];
    }
    for (let y = horizon < 0 ? 0 : horizon; y < VIEW_H; y++) {
      const rowOff = y * W;
      for (let x = 0; x < W; x++) buf[rowOff + x] = 0xFF000000;
    }
  } else {
    buf.fill(0xFF000000);
  }
  depth.fill(1e9);

  // --- walls, floors, ceilings: one march per column ---
  for (let x = 0; x < W; x++) {
    const cameraX = 2 * x / W - 1;
    const rayX = dirX + planeX * cameraX;
    const rayY = dirY + planeY * cameraX;
    let mapX = camX | 0, mapY = camY | 0;
    const deltaX = Math.abs(1 / (rayX || 1e-9));
    const deltaY = Math.abs(1 / (rayY || 1e-9));
    let stepX, stepY, sideX, sideY;
    if (rayX < 0) { stepX = -1; sideX = (camX - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - camX) * deltaX; }
    if (rayY < 0) { stepY = -1; sideY = (camY - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - camY) * deltaY; }

    // the whole column starts unpainted
    spanA[0] = 0; spanB[0] = VIEW_H;
    let spanN = 1;

    // paint [y0,y1) wherever it is still open, calling f(a, b) per piece
    const paint = (y0, y1, f) => {
      if (y1 <= y0) return;
      for (let i = 0; i < spanN; i++) {
        const a = spanA[i], b = spanB[i];
        if (y1 <= a || y0 >= b) continue;
        const ca = y0 > a ? y0 : a;
        const cb = y1 < b ? y1 : b;
        f(ca, cb);
        if (ca <= a && cb >= b) {          // span fully covered
          spanN--;
          spanA[i] = spanA[spanN]; spanB[i] = spanB[spanN];
          i--;
        } else if (ca <= a) {              // covered from the top
          spanA[i] = cb;
        } else if (cb >= b) {              // covered from the bottom
          spanB[i] = ca;
        } else if (spanN < MAX_SPANS) {    // punched a hole: two pieces left
          spanB[i] = ca;
          spanA[spanN] = cb; spanB[spanN] = b; spanN++;
        } else {
          spanB[i] = ca;                   // out of room: drop the far piece
        }
      }
    };

    let dEnter = 0, side = 0, first = true;
    for (let it = 0; it < 128 && spanN > 0; it++) {
      let dExit, nextSide;
      if (sideX < sideY) { dExit = sideX; nextSide = 0; }
      else { dExit = sideY; nextSide = 1; }

      // Off the edge of the map there is nothing to draw: whatever the column
      // still has open keeps the background, which is sky above and dark below.
      // Every level walls itself in, so this is a backstop, not a view.
      if (mapX < 0 || mapY < 0 || mapX >= lvl.w || mapY >= lvl.h) break;

      const cell = lvl.slabs[mapY * lvl.w + mapX];
      if (cell) {
        const dA = dEnter < 0.005 ? 0.005 : dEnter;
        const dB = dExit < 0.005 ? 0.005 : dExit;

        // where the ray crossed into this cell, for the face texture
        let wallX = 0;
        if (!first) {
          wallX = side === 0 ? camY + dA * rayY : camX + dA * rayX;
          wallX -= Math.floor(wallX);
        }
        // mirror so a texture is not flipped on opposing faces
        const flip = (side === 0 && rayX > 0) || (side === 1 && rayY < 0);

        const faceLight0 = fogLight(dA, flicker, ambient, fogK);
        const faceLight = side === 1 ? faceLight0 * 0.72 : faceLight0;
        const invA = VIEW_H / dA, invB = VIEW_H / dB;

        // a door slides into its own doorway: past the opening the ray carries
        // on as if the cell were empty
        const dr = lvl.doors && lvl.doors[mapY * lvl.w + mapX];
        const doorOpen = dr ? dr.open : 0;
        const doorPassed = first || wallX < doorOpen;

        // Faces first, then the horizontal surfaces of the same cell. A face
        // stands at the cell's near edge, so it hides that cell's own floor and
        // ceiling; drawing them in the other order paints floor over the wall.
        for (let s = 0; s < cell.length; s++) {
          const sl = cell[s];
          if (sl.door && doorPassed) continue;

          // --- the vertical face where the ray entered ---
          if (!first && sl.side) {
            const yTop = horizon + (camZ - sl.z1) * invA;
            const yBot = horizon + (camZ - sl.z0) * invA;
            let y0 = Math.floor(yTop), y1 = Math.ceil(yBot);
            if (y0 < 0) y0 = 0; if (y1 > VIEW_H) y1 = VIEW_H;
            if (y1 > y0) {
              const tex = (textures[sl.side] || textures[opts.borderTex]).data;
              let u = ((sl.door ? wallX - doorOpen : wallX) * TS) | 0;
              if (u < 0) u = 0; if (u > TMASK) u = TMASK;
              if (flip) u = TMASK - u;
              // read per frame, not baked into the slab: a cottage window is
              // lit or dark depending on the hour
              const sdef = lvl.tiles && lvl.tiles[sl.side];
              let lt = faceLight;
              if (sdef && sdef.glow) lt = lt > 0.88 ? lt : 0.88;
              paint(y0, y1, (a, b) => {
                for (let y = a; y < b; y++) {
                  // world height of this pixel, so tall walls tile the texture
                  const z = camZ - (y - horizon) / invA;
                  let v = (sl.z1 - z) % 1;
                  if (v < 0) v += 1;
                  const o = y * W + x;
                  buf[o] = shadePix(tex[((v * TS) | 0) * TS + u], lt);
                  depth[o] = dA;
                }
              });
            }
          }
        }

        // --- horizontal surfaces, spanning this cell's slice of the ray ---
        // Top of a slab seen from above, underside seen from below.
        for (let s = 0; s < cell.length; s++) {
          const sl = cell[s];
          if (sl.door && doorPassed) continue;
          for (let f = 0; f < 2; f++) {
            const zw = f === 0 ? sl.z1 : sl.z0;
            const texId = f === 0 ? sl.top : sl.bot;
            if (!texId) continue;
            const rel = camZ - zw;
            if (f === 0 ? rel <= 0 : rel >= 0) continue; // facing away
            const yNear = horizon + rel * invA;
            const yFar = horizon + rel * invB;
            let y0, y1;
            if (yFar < yNear) { y0 = Math.ceil(yFar); y1 = Math.ceil(yNear); }
            else { y0 = Math.floor(yNear); y1 = Math.floor(yFar); }
            if (y0 < 0) y0 = 0; if (y1 > VIEW_H) y1 = VIEW_H;
            if (y1 <= y0) continue;
            const tex = (textures[texId] || textures[opts.borderTex]).data;
            paint(y0, y1, (a, b) => {
              for (let y = a; y < b; y++) {
                const p = y - horizon;
                if (p === 0) continue;
                const d = rel * VIEW_H / p;      // distance to this row's ground
                if (d < 0) continue;
                const wx = camX + d * rayX, wy = camY + d * rayY;
                const tx = ((wx - Math.floor(wx)) * TS) | 0;
                const ty = ((wy - Math.floor(wy)) * TS) | 0;
                const o = y * W + x;
                buf[o] = shadePix(tex[ty * TS + tx], fogLight(d, flicker, ambient, fogK));
                depth[o] = d;
              }
            });
          }
        }
      }

      if (nextSide === 0) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      dEnter = dExit;
      first = false;
    }
  }

  // --- billboards ---
  const rl = [];
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  for (const b of billboards) {
    const sx = b.x - camX, sy = b.y - camY;
    const tx = invDet * (dirY * sx - dirX * sy);
    const ty = invDet * (-planeY * sx + planeX * sy);
    if (ty <= 0.15) continue;
    rl.push({ ty, tx, b });
  }
  rl.sort((a, b) => b.ty - a.ty);

  for (const s of rl) {
    const b = s.b;
    const spr = b.img;
    const fullH = VIEW_H / s.ty;
    // a sprite stands on the ground its own cell gives it, not on the camera's
    const base = b.z != null ? b.z : 0;
    const floorLine = horizon + (camZ - base) * fullH;
    const sh = b.hFrac * fullH;
    const sw = sh * (spr.w / spr.h); // keep art aspect
    const bottom = floorLine - b.zOff * fullH;
    const top = bottom - sh;
    const cxs = (W / 2) * (1 + s.tx / s.ty);
    let x0 = Math.floor(cxs - sw / 2), x1 = Math.ceil(cxs + sw / 2);
    let light = fogLight(s.ty, flicker, ambient, fogK);
    if (b.glow) light = Math.max(light, 0.85);
    if (x1 < 0 || x0 >= W) continue;
    if (x0 < 0) x0 = 0; if (x1 > W) x1 = W;
    const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(VIEW_H, Math.ceil(bottom));
    for (let x = x0; x < x1; x++) {
      const u = ((x - (cxs - sw / 2)) / sw * spr.w) | 0;
      if (u < 0 || u >= spr.w) continue;
      for (let y = y0; y < y1; y++) {
        const o = y * W + x;
        if (s.ty >= depth[o]) continue; // behind whatever this pixel shows
        const v = ((y - top) / sh * spr.h) | 0;
        if (v < 0 || v >= spr.h) continue;
        const c = spr.data[v * spr.w + u];
        if (!(c >>> 24)) continue;
        buf[o] = shadePix(c, light);
        depth[o] = s.ty;
      }
    }
  }
}
