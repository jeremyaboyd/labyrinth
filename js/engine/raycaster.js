// ---- engine/raycaster: pure software renderer ----
// Knows nothing about game entities or tile meanings. The caller supplies:
//   view       from createView(W, H)
//   lvl        { w, h, map, doors, tiles, floorMap? }
//                tiles[id].door   => sliding door
//                tiles[id].noWall => solid to the grid, invisible to the ray
//                tiles[id].glow   => wall lit from within, ignores distance
//                floorMap         => per-cell floor texture ids (else floorTex)
//   cam        { x, y, a, bob }
//   billboards [{ x, y, img: {w,h,data}, hFrac, zOff, glow }]
//   opts       { textures, texSize (pow2), floorTex, ceilTex, borderTex,
//                fovPlane?, flicker?, ambient?, fogK?, sky? }
//                sky => panorama {w (pow2), h, data} drawn above the horizon
//                       in place of the ceiling, sampled by view angle
'use strict';

const TAU = Math.PI * 2;

function createView(W, H) {
  const frameImg = new ImageData(W, H);
  return {
    W, H, frameImg,
    buf: new Uint32Array(frameImg.data.buffer),
    zBuffer: new Float32Array(W),
    skyU: new Int32Array(W), // per-column sky sample, reused each frame
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
  const buf = view.buf, zBuffer = view.zBuffer;
  const textures = opts.textures;
  const TS = opts.texSize;
  const flicker = opts.flicker != null ? opts.flicker : 1;
  const ambient = opts.ambient != null ? opts.ambient : 1;
  const fogK = opts.fogK != null ? opts.fogK : 0.10;
  const fov = opts.fovPlane != null ? opts.fovPlane : 0.66;
  const sky = opts.sky || null;
  const floorMap = lvl.floorMap || null;

  const camX = cam.x, camY = cam.y;
  const horizon = (VIEW_H >> 1) + Math.round(cam.bob || 0);
  const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
  const planeX = -dirY * fov, planeY = dirX * fov;
  const posZ = 0.5 * VIEW_H;

  // --- sky: a panorama wrapped around the view, drawn full brightness ---
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
  }

  // --- floor & ceiling ---
  const floorTex = textures[opts.floorTex].data, ceilTex = textures[opts.ceilTex].data;
  const rd0x = dirX - planeX, rd0y = dirY - planeY;
  const rd1x = dirX + planeX, rd1y = dirY + planeY;
  const yStart = sky ? horizon : 0; // sky already covered everything above
  for (let y = yStart < 0 ? 0 : yStart; y < VIEW_H; y++) {
    const p = y - horizon;
    if (p === 0) {
      if (!sky) {
        const c = shadePix(rgb(20, 18, 16), 0.2);
        for (let x = 0; x < W; x++) buf[y * W + x] = c;
      }
      continue;
    }
    const rowDist = p > 0 ? posZ / p : posZ / -p;
    const light = fogLight(rowDist, flicker, ambient, fogK);
    if (light <= 0.02) {
      for (let x = 0; x < W; x++) buf[y * W + x] = 0xFF000000;
      continue;
    }
    const stepX = rowDist * (rd1x - rd0x) / W;
    const stepY = rowDist * (rd1y - rd0y) / W;
    let fx = camX + rowDist * rd0x;
    let fy = camY + rowDist * rd0y;
    const flat = p > 0 ? floorTex : ceilTex;
    const perCell = floorMap && p > 0; // ground varies by cell, ceilings do not
    const rowOff = y * W;
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      const tx = ((fx - cx) * TS) | 0;
      const ty = ((fy - cy) * TS) | 0;
      let tex = flat;
      if (perCell && cx >= 0 && cy >= 0 && cx < lvl.w && cy < lvl.h) {
        const id = floorMap[cy * lvl.w + cx];
        if (id) tex = textures[id].data;
      }
      buf[rowOff + x] = shadePix(tex[ty * TS + tx], light);
      fx += stepX; fy += stepY;
    }
  }

  // --- walls (DDA) ---
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

    let side = 0, hitTex = 0, perp = 30, wallX = 0, hitGlow = false;
    for (let it = 0; it < 128; it++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= lvl.w || mapY >= lvl.h) { hitTex = opts.borderTex; perp = 30; break; }
      const c = lvl.map[mapY * lvl.w + mapX];
      if (c === 0) continue;
      const def = lvl.tiles[c];
      // blocks movement but is drawn as a sprite (trees, posts) or is
      // ground-level (water): the ray carries on past it
      if (def && def.noWall) continue;
      const pd = side === 0 ? sideX - deltaX : sideY - deltaY;
      let wx = side === 0 ? camY + pd * rayY : camX + pd * rayX;
      wx -= Math.floor(wx);
      if (def && def.door) {
        const d = lvl.doors[mapY * lvl.w + mapX];
        const open = d ? d.open : 0;
        if (wx < open) continue; // ray slips through the opening gap
        hitTex = c; perp = pd; wallX = wx - open;
        break;
      }
      hitTex = c; perp = pd; wallX = wx;
      hitGlow = !!(def && def.glow);
      break;
    }
    if (perp < 0.01) perp = 0.01;
    zBuffer[x] = perp;

    const lineH = (VIEW_H / perp) | 0;
    let drawStart = horizon - (lineH >> 1);
    let drawEnd = drawStart + lineH;
    const tex = (textures[hitTex] || textures[opts.borderTex]).data;
    let texX = (wallX * TS) | 0;
    if (texX < 0) texX = 0; if (texX > TS - 1) texX = TS - 1;
    // mirror so texture isn't flipped on two faces
    const rayXpos = side === 0 && rayX > 0, rayYneg = side === 1 && rayY < 0;
    if (rayXpos || rayYneg) texX = TS - 1 - texX;

    let light = fogLight(perp, flicker, ambient, fogK);
    if (side === 1) light *= 0.72;
    if (hitGlow) light = Math.max(light, 0.88); // lamplight from inside

    const texStep = TS / lineH;
    let texPos = drawStart < 0 ? -drawStart * texStep : 0;
    if (drawStart < 0) drawStart = 0;
    if (drawEnd > VIEW_H) drawEnd = VIEW_H;
    for (let y = drawStart; y < drawEnd; y++) {
      const texY = texPos & (TS - 1);
      texPos += texStep;
      buf[y * W + x] = shadePix(tex[texY * TS + texX], light);
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
    const floorLine = horizon + fullH / 2;
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
      if (s.ty >= zBuffer[x]) continue;
      const u = ((x - (cxs - sw / 2)) / sw * spr.w) | 0;
      if (u < 0 || u >= spr.w) continue;
      for (let y = y0; y < y1; y++) {
        const v = ((y - top) / sh * spr.h) | 0;
        if (v < 0 || v >= spr.h) continue;
        const c = spr.data[v * spr.w + u];
        if (!(c >>> 24)) continue;
        buf[y * W + x] = shadePix(c, light);
      }
    }
  }
}
